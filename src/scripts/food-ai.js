function inferMealTime(input, foodName) {
  const markers = [
    { mealTime: "早餐", words: ["早餐", "早上", "早饭", "早晨"] },
    { mealTime: "午餐", words: ["午餐", "中午", "午饭"] },
    { mealTime: "晚餐", words: ["晚餐", "晚上", "晚饭"] },
  ];
  const foodIndex = input.indexOf(foodName);
  let matchedMealTime = "";
  let matchedIndex = -1;

  markers.forEach((marker) => {
    marker.words.forEach((word) => {
      const markerIndex = input.lastIndexOf(word, foodIndex >= 0 ? foodIndex : input.length);
      if (markerIndex > matchedIndex) {
        matchedIndex = markerIndex;
        matchedMealTime = marker.mealTime;
      }
    });
  });

  return matchedMealTime;
}

async function analyzeFoodTextOnline(text) {
  if (window.location.protocol === "file:") {
    throw new Error("当前是本地文件预览，不能访问后端 AI 接口。请用 Vercel 线上地址测试。");
  }

  const response = await fetch("/api/analyze-food", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  }).catch(() => {
    throw new Error("网络异常，请检查连接");
  });

  const data = await response.json().catch(() => {
    throw new Error("AI返回格式异常，请重试");
  });
  if (!response.ok) {
    throw new Error(data.error || mapApiError(data.errorType));
  }

  return normalizeOnlineFoodAnalysis(data, text);
}

async function analyzeFoodImageOnline(image) {
  if (window.location.protocol === "file:") {
    throw new Error("当前是本地文件预览，不能访问后端 AI 接口。请用 Vercel 线上地址测试。");
  }

  const response = await fetch("/api/analyze-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image }),
  }).catch(() => {
    throw new Error("网络异常，请检查连接");
  });

  const data = await response.json().catch(() => {
    throw new Error("AI返回格式异常，请重试");
  });
  if (!response.ok) {
    throw new Error(data.error || mapApiError(data.errorType));
  }

  return normalizeImageFoodAnalysis(data);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("图片读取失败，请重新上传")));
    reader.readAsDataURL(file);
  });
}

function mapApiError(errorType) {
  const messages = {
    missing_key: "后端未读取到 OPENAI_API_KEY",
    api_failed: "AI分析失败，请稍后重试",
    json_parse: "AI返回格式异常，请重试",
    network: "网络异常，请检查连接",
  };
  return messages[errorType] || "AI分析失败，请稍后重试";
}

function normalizeImageFoodAnalysis(data) {
  const foods = (data.foods || []).map((food) => {
    const nutrition = {
      calories: Number(food.calories || 0),
      proteinG: Number(food.protein || 0),
      carbG: Number(food.carbs || 0),
      fatG: Number(food.fat || 0),
    };

    return {
      name: food.name,
      quantity: food.quantity || "约1份",
      weight: food.estimatedWeight || "AI估算份量",
      confidence: food.confidence || "中",
      calories: nutrition.calories,
      protein: nutrition.proteinG,
      carbs: nutrition.carbG,
      fat: nutrition.fatG,
      nutrition,
    };
  });
  const total = data.mealTotal || {};

  return {
    foods: foods.map((food) => ({
      name: food.name,
      amount: food.quantity,
      estimatedWeight: food.weight,
      confidence: food.confidence,
      nutrition: food.nutrition,
    })),
    mealItems: foods,
    nutrition: {
      calories: Number(total.calories || 0),
      proteinG: Number(total.protein || 0),
      carbG: Number(total.carbs || 0),
      fatG: Number(total.fat || 0),
    },
    note: data.summary || "图片识别结果为估算值，可根据实际份量修改。",
  };
}

function normalizeOnlineFoodAnalysis(data, input) {
  const foods = (data.foods || []).map((food) => {
    const mealTime = inferMealTime(input, food.name) || data.mealName || "未分类饮食";
    const nutrition = {
      calories: Number(food.calories || 0),
      proteinG: Number(food.protein || 0),
      carbG: Number(food.carbs || 0),
      fatG: Number(food.fat || 0),
    };

    return {
      name: food.name,
      mealTime,
      quantity: food.quantity || "1份",
      weight: food.estimatedWeight || "AI估算份量",
      confidence: food.confidence || "中",
      estimateNote: data.summary || "AI估算值，可修改",
      calories: nutrition.calories,
      protein: nutrition.proteinG,
      carbs: nutrition.carbG,
      fat: nutrition.fatG,
      nutrition,
    };
  });
  const total = data.mealTotal || data.total || {};
  const nutrition = {
    calories: Number(total.calories || 0),
    proteinG: Number(total.protein || 0),
    carbG: Number(total.carbs || 0),
    fatG: Number(total.fat || 0),
  };

  return {
    input,
    foods: foods.map((food) => ({
      name: food.name,
      amount: food.quantity,
      mealTime: food.mealTime,
      estimatedWeight: food.weight,
      confidence: food.confidence,
      nutrition: food.nutrition,
    })),
    mealItems: foods,
    nutrition,
    note: foods.length > 0 ? `联网 GPT 已识别 ${foods.length} 个食物。${data.summary || ""}` : "联网 GPT 没有识别到明确食物。",
  };
}
