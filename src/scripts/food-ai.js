const sampleFoodResults = [
  {
    name: "虾仁米饭餐",
    calories: 430,
    confidence: 86,
    items: ["虾仁", "米饭", "青菜"],
    note: "蛋白质较好，米饭正常保留，适合作为午餐。",
  },
  {
    name: "鸡腿面条",
    calories: 520,
    confidence: 82,
    items: ["鸡腿", "面条", "蔬菜"],
    note: "碳水偏完整，晚餐吃的话建议面量控制在半份。",
  },
  {
    name: "牛排鸡蛋餐",
    calories: 460,
    confidence: 79,
    items: ["牛排", "鸡蛋", "蔬菜"],
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
