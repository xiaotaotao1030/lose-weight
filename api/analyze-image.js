function sumNutrition(foods) {
  return foods.reduce(
    (total, food) => ({
      calories: total.calories + Number(food.calories || 0),
      protein: total.protein + Number(food.protein || 0),
      carbs: total.carbs + Number(food.carbs || 0),
      fat: total.fat + Number(food.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function normalizeImageAnalysis(data) {
  const foods = (data.foods || [])
    .filter((food) => food.name)
    .map((food) => ({
      name: String(food.name || ""),
      quantity: String(food.quantity || "约1份"),
      estimatedWeight: String(food.estimatedWeight || "约常规份量"),
      calories: Number(food.calories || 0),
      protein: Number(food.protein || 0),
      carbs: Number(food.carbs || 0),
      fat: Number(food.fat || 0),
      confidence: String(food.confidence || "中"),
    }));
  const mealTotal = data.mealTotal || sumNutrition(foods);

  return {
    foods,
    mealTotal: {
      calories: Number(mealTotal.calories || 0),
      protein: Number(mealTotal.protein || 0),
      carbs: Number(mealTotal.carbs || 0),
      fat: Number(mealTotal.fat || 0),
    },
    summary: data.summary || "图片识别结果为估算值，可根据实际份量修改。",
  };
}

function extractOutputText(responseJson) {
  if (responseJson.output_text) {
    return responseJson.output_text;
  }

  return (responseJson.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("");
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "只支持 POST 请求" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    response.status(500).json({ errorType: "missing_key", error: "后端未读取到 OPENAI_API_KEY" });
    return;
  }

  const image = String(request.body?.image || "");
  if (!image.startsWith("data:image/")) {
    response.status(400).json({ error: "请上传食物图片" });
    return;
  }

  let openaiResponse;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "你是专业营养分析助手。请根据用户上传的食物图片，识别图片中真实存在的食物。只识别图片中能看到的食物，不要编造图片中没有的食物。如果图片是牛排，就识别为牛排、牛肉或steak，不要把牛排识别成鸡腿面条。如果无法确定，请在名称中写“疑似”。估算每种食物重量、热量、蛋白质、碳水和脂肪。只返回JSON。",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "请识别这张食物图片，并返回结构化营养估算。",
              },
              {
                type: "input_image",
                image_url: image,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "image_food_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                foods: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "string" },
                      estimatedWeight: { type: "string" },
                      calories: { type: "number" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fat: { type: "number" },
                      confidence: { type: "string", enum: ["高", "中", "低"] },
                    },
                    required: [
                      "name",
                      "quantity",
                      "estimatedWeight",
                      "calories",
                      "protein",
                      "carbs",
                      "fat",
                      "confidence",
                    ],
                  },
                },
                mealTotal: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    calories: { type: "number" },
                    protein: { type: "number" },
                    carbs: { type: "number" },
                    fat: { type: "number" },
                  },
                  required: ["calories", "protein", "carbs", "fat"],
                },
                summary: { type: "string" },
              },
              required: ["foods", "mealTotal", "summary"],
            },
          },
        },
      }),
    });
  } catch (error) {
    response.status(502).json({ errorType: "network", error: "网络异常，请检查连接" });
    return;
  }

  const openaiJson = await openaiResponse.json().catch(() => ({}));
  if (!openaiResponse.ok) {
    response.status(openaiResponse.status).json({
      errorType: "api_failed",
      error: openaiJson.error?.message || "AI分析失败，请稍后重试",
    });
    return;
  }

  try {
    const parsed = JSON.parse(extractOutputText(openaiJson));
    response.status(200).json(normalizeImageAnalysis(parsed));
  } catch (error) {
    response.status(502).json({ errorType: "json_parse", error: "AI返回格式异常，请重试" });
  }
};
