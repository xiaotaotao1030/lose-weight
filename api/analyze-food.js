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

function normalizeFoodAnalysis(data) {
  const foods = (data.foods || [])
    .filter((food) => food.name)
    .map((food) => ({
      name: String(food.name || ""),
      quantity: String(food.quantity || "1份"),
      estimatedWeight: String(food.estimatedWeight || "约常规份量"),
      calories: Number(food.calories || 0),
      protein: Number(food.protein || 0),
      carbs: Number(food.carbs || 0),
      fat: Number(food.fat || 0),
      confidence: String(food.confidence || "中"),
    }));
  const mealTotal = data.mealTotal || data.total || sumNutrition(foods);

  return {
    mealName: data.mealName || "未分类饮食",
    foods,
    mealTotal: {
      calories: Number(mealTotal.calories || 0),
      protein: Number(mealTotal.protein || 0),
      carbs: Number(mealTotal.carbs || 0),
      fat: Number(mealTotal.fat || 0),
    },
    summary: data.summary || "本餐为估算值，可根据实际份量修改。",
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "缺少 OPENAI_API_KEY 环境变量" });
    return;
  }

  const text = String(request.body?.text || "").trim();
  if (!text) {
    response.status(400).json({ error: "请输入饮食内容" });
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
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "你是营养记录助手。请从中文饮食描述中识别所有可能食物，不允许只返回第一个食物。把每个独立食物分开估算数量、重量、热量、蛋白质、碳水和脂肪。无法确定重量时使用常见默认份量估算，并在summary说明估算。根据描述判断mealName，只能是早餐、午餐、晚餐、加餐、饮品、未分类饮食。只输出JSON。",
          },
          {
            role: "user",
            content: text,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "food_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                mealName: {
                  type: "string",
                  enum: ["早餐", "午餐", "晚餐", "加餐", "饮品", "未分类饮食"],
                },
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
              required: ["mealName", "foods", "mealTotal", "summary"],
            },
          },
        },
      }),
    });
  } catch (error) {
    response.status(502).json({ error: "网络请求 OpenAI 失败" });
    return;
  }

  const openaiJson = await openaiResponse.json().catch(() => ({}));
  if (!openaiResponse.ok) {
    response.status(openaiResponse.status).json({ error: openaiJson.error?.message || "OpenAI 调用失败" });
    return;
  }

  try {
    const parsed = JSON.parse(extractOutputText(openaiJson));
    response.status(200).json(normalizeFoodAnalysis(parsed));
  } catch (error) {
    response.status(502).json({ error: "OpenAI 返回格式无法解析" });
  }
};
