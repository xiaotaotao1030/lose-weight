const sampleFoodResults = [
  {
    name: "虾仁米饭餐",
    confidence: 86,
    weight: "约 370g",
    items: ["虾仁 120g", "米饭 150g", "青菜 100g"],
    nutrition: { calories: 430, proteinG: 31, carbG: 55, fatG: 8 },
    note: "蛋白质较好，米饭正常保留，适合作为午餐。",
  },
  {
    name: "鸡腿面条",
    confidence: 82,
    weight: "约 420g",
    items: ["鸡腿肉 120g", "面条 180g", "蔬菜 120g"],
    nutrition: { calories: 520, proteinG: 34, carbG: 62, fatG: 14 },
    note: "碳水偏完整，晚餐吃的话建议面量控制在半份。",
  },
  {
    name: "牛排鸡蛋餐",
    confidence: 79,
    weight: "约 300g",
    items: ["牛排 120g", "鸡蛋 1个", "蔬菜 120g"],
    nutrition: { calories: 460, proteinG: 38, carbG: 10, fatG: 28 },
    note: "蛋白质充足，建议搭配少量米饭或土豆补充碳水。",
  },
];

function mockRecognizeFood(file) {
  const index = file.size % sampleFoodResults.length;

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(sampleFoodResults[index]);
    }, 900);
  });
}

function inferMealTime(input, foodName) {
  const markers = [
    { mealTime: "早餐", words: ["早餐", "早上", "早饭", "早晨"] },
    { mealTime: "午餐", words: ["午餐", "中午", "午饭"] },
    { mealTime: "晚餐", words: ["晚餐", "晚上", "晚饭"] },
  ];
  const foodIndex = input.indexOf(foodName);
  let matchedMealTime = "零食";
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
    throw new Error("联网 GPT 模式需要通过 Vercel 部署地址打开，不能直接用本地 file 页面");
  }

  const response = await fetch("/api/analyze-food", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "联网 AI 分析失败");
  }

  return normalizeOnlineFoodAnalysis(data, text);
}

function normalizeOnlineFoodAnalysis(data, input) {
  const foods = (data.foods || []).map((food) => {
    const mealTime = inferMealTime(input, food.name);
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
      weight: food.quantity || "AI估算份量",
      estimateNote: "AI估算值，可修改",
      calories: nutrition.calories,
      protein: nutrition.proteinG,
      carbs: nutrition.carbG,
      fat: nutrition.fatG,
      nutrition,
    };
  });
  const total = data.total || {};
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
      nutrition: food.nutrition,
    })),
    mealItems: foods,
    nutrition,
    note: foods.length > 0 ? `联网 GPT 已识别 ${foods.length} 个食物。` : "联网 GPT 没有识别到明确食物。",
  };
}
