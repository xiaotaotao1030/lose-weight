const userProfile = {
  gender: "female",
  age: 25,
  heightCm: 163,
  currentWeightKg: 62,
  targetWeightKg: 50,
  targetDays: 90,
  activityLevel: "light",
  foodLikes: ["虾仁", "鸡腿", "牛排", "鸡蛋"],
  foodDislikes: ["卤牛肉", "燕麦"],
  carbPreference: "保留米饭、面条等正常碳水",
  drinkPreference: "无糖柠檬水或无糖油柑水",
};

const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

function roundTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculatePlan(profile) {
  const heightM = profile.heightCm / 100;
  const bmi = profile.currentWeightKg / (heightM * heightM);
  const genderOffset = profile.gender === "male" ? 5 : -161;
  const bmr = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + genderOffset;
  const tdee = bmr * activityFactors[profile.activityLevel];
  const weightToLose = profile.currentWeightKg - profile.targetWeightKg;
  const targetDailyDeficit = (weightToLose * 7700) / profile.targetDays;
  const dailyDeficit = Math.min(targetDailyDeficit, 600);
  const calories = Math.max(tdee - dailyDeficit, 1200);
  const proteinG = profile.currentWeightKg * 1.6;
  const fatG = (calories * 0.25) / 9;
  const carbG = (calories - proteinG * 4 - fatG * 9) / 4;
  const expectedLossKg = (dailyDeficit * profile.targetDays) / 7700;

  return {
    bmi: roundTo(bmi, 1),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(calories / 10) * 10,
    targetDailyDeficit: Math.round(targetDailyDeficit),
    dailyDeficit: Math.round(dailyDeficit),
    proteinG: Math.round(proteinG),
    carbG: Math.round(carbG),
    fatG: Math.round(fatG),
    expectedWeightKg: roundTo(profile.currentWeightKg - expectedLossKg, 1),
    isAggressiveGoal: targetDailyDeficit > 600,
  };
}
