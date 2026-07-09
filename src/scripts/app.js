const tabs = document.querySelectorAll(".tab-item");
const pages = document.querySelectorAll(".page");
const foodPhotoInput = document.querySelector("#food-photo");
const foodPreview = document.querySelector("[data-food-preview]");
const aiResult = document.querySelector("[data-ai-result]");
const foodTextInput = document.querySelector("[data-food-text-input]");
const analyzeFoodTextButton = document.querySelector("[data-analyze-food-text]");
const addTextFoodRecordButton = document.querySelector("[data-add-text-food-record]");
const addPhotoFoodRecordButton = document.querySelector("[data-add-photo-food-record]");
const recordDateInput = document.querySelector("[data-record-date]");
const recordWeightInput = document.querySelector("[data-record-weight]");
const recordFoodInput = document.querySelector("[data-record-food]");
const recordExerciseInput = document.querySelector("[data-record-exercise]");
const recordExerciseTypeInput = document.querySelector("[data-record-exercise-type]");
const recordExerciseMinutesInput = document.querySelector("[data-record-exercise-minutes]");
const recordExerciseCaloriesInput = document.querySelector("[data-record-exercise-calories]");
const recordBowelHasInput = document.querySelector("[data-record-bowel-has]");
const recordBowelStatusInput = document.querySelector("[data-record-bowel-status]");
const recordBowelNoteInput = document.querySelector("[data-record-bowel-note]");
const saveDailyRecordButton = document.querySelector("[data-save-daily-record]");
const waterManualInput = document.querySelector("[data-water-manual]");
const saveWaterButton = document.querySelector("[data-save-water]");
const waterAddButtons = document.querySelectorAll("[data-water-add]");
const profileStoreKey = "light-plan-user-profile";
const profileInputs = {
  gender: document.querySelector("[data-profile-gender]"),
  age: document.querySelector("[data-profile-age]"),
  heightCm: document.querySelector("[data-profile-height]"),
  currentWeightKg: document.querySelector("[data-profile-current-weight]"),
  targetWeightKg: document.querySelector("[data-profile-target-weight]"),
  targetDays: document.querySelector("[data-profile-target-days]"),
  activityLevel: document.querySelector("[data-profile-activity]"),
};
const saveProfileButton = document.querySelector("[data-save-profile]");
let pendingTextFoodAnalysis = null;
let pendingPhotoFoodAnalysis = null;
let pendingFoodPhotoData = "";
let activeProfile = readUserProfile();
let plan = calculatePlan(activeProfile);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

function readUserProfile() {
  const saved = localStorage.getItem(profileStoreKey);
  if (!saved) {
    return { ...userProfile };
  }

  try {
    return { ...userProfile, ...JSON.parse(saved) };
  } catch (error) {
    return { ...userProfile };
  }
}

function saveUserProfile(profile) {
  localStorage.setItem(profileStoreKey, JSON.stringify(profile));
}

function renderProfileSummary() {
  activeProfile = readUserProfile();
  plan = calculatePlan(activeProfile);

  setText("[data-current-weight]", activeProfile.currentWeightKg);
  setText("[data-target-weight]", activeProfile.targetWeightKg);
  setText("[data-target-days]", activeProfile.targetDays);
  setText("[data-goal-label]", `${activeProfile.targetDays} 天目标`);
  setText("[data-bmi]", plan.bmi);
  setText("[data-bmr]", plan.bmr);
  setText("[data-calories]", plan.calories);
  setText("[data-deficit]", plan.dailyDeficit);
  setText("[data-profile-bmi]", plan.bmi);
  setText("[data-profile-bmr]", plan.bmr);
  setText("[data-profile-calories]", plan.calories);
  setText("[data-profile-protein]", plan.proteinG);
  setText(
    "[data-goal-notice]",
    plan.isAggressiveGoal
      ? `目标需要每日约 ${plan.targetDailyDeficit} kcal 缺口。当前算法先按每日 ${plan.dailyDeficit} kcal 缺口计算，预计到 ${plan.expectedWeightKg}kg 左右。`
      : "当前目标节奏合理，可以按记录结果微调。"
  );

  if (profileInputs.gender) {
    profileInputs.gender.value = activeProfile.gender;
    profileInputs.age.value = activeProfile.age;
    profileInputs.heightCm.value = activeProfile.heightCm;
    profileInputs.currentWeightKg.value = activeProfile.currentWeightKg;
    profileInputs.targetWeightKg.value = activeProfile.targetWeightKg;
    profileInputs.targetDays.value = activeProfile.targetDays;
    profileInputs.activityLevel.value = activeProfile.activityLevel;
  }
}

function setProgress(selector, value, target) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }

  const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  element.style.width = `${Math.round(percent)}%`;
}

function formatExercise(exercise) {
  if (!exercise || exercise.type === "none") {
    return "无运动";
  }

  const typeMap = {
    walk: "步行",
    run: "跑步",
    strength: "力量训练",
    yoga: "瑜伽",
    cycling: "骑行",
    other: "其他",
  };
  const calories = Number(exercise.calories || 0);
  return `${typeMap[exercise.type] || exercise.type} ${exercise.minutes || 0} 分钟${calories ? ` · 消耗 ${calories} kcal` : ""}`;
}

function formatBowel(bowel) {
  if (!bowel || bowel.hasBowel === null) {
    return "未记录";
  }

  return bowel.hasBowel ? bowel.status || "有" : "无";
}

function calculateCompletion(record) {
  const items = [
    record.nutritionTotals.calories > 0,
    record.water.amountL > 0,
    record.weight.valueKg,
    record.exercise.type !== "none" || record.exercise.note,
    record.bowel.hasBowel !== null,
  ];
  const done = items.filter(Boolean).length;
  return Math.round((done / items.length) * 100);
}

function getNutritionPercent(value, target) {
  return target > 0 ? Math.round((value / target) * 100) : 0;
}

function getMealHour(time) {
  if (!time) {
    return 12;
  }

  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return 12;
  }

  let hour = Number(match[1]);
  if (time.includes("下午") && hour < 12) {
    hour += 12;
  }
  if (time.includes("上午") && hour === 12) {
    hour = 0;
  }
  return hour;
}

function getMealSlot(time) {
  const hour = getMealHour(time);
  if (hour < 11) {
    return "breakfast";
  }
  if (hour < 16) {
    return "lunch";
  }
  return "dinner";
}

function formatFoodNames(foods) {
  if (!foods || foods.length === 0) {
    return "未填写食物";
  }

  return foods.map((food) => `${food.name}${food.amount ? ` ${food.amount}` : ""}`).join("、");
}

function formatGap(value, target) {
  const gap = Math.round(target - value);
  return gap >= 0 ? `还差 ${gap}g` : `已超出 ${Math.abs(gap)}g`;
}

function formatCalorieGap(value, target) {
  const gap = Math.round(target - value);
  return gap >= 0 ? `${gap}` : `已超出 ${Math.abs(gap)}`;
}

function estimateExerciseCalories(type, minutes) {
  const perMinute = {
    none: 0,
    walk: 4,
    run: 8,
    strength: 6,
    yoga: 3,
    cycling: 7,
    other: 5,
  };
  return Math.round((perMinute[type] || 0) * Number(minutes || 0));
}

function renderMealTimeline(record) {
  const timeline = document.querySelector("[data-dashboard-meal-timeline]");
  if (!timeline) {
    return;
  }

  const slots = [
    { id: "breakfast", name: "早餐" },
    { id: "lunch", name: "午餐" },
    { id: "dinner", name: "晚餐" },
  ];
  const entries = [];
  record.meals.forEach((meal) => {
    if (meal.foods?.length) {
      meal.foods.forEach((food, foodIndex) => {
        entries.push({
          id: `${meal.id}-${foodIndex}`,
          mealId: meal.id,
          foodIndex,
          time: meal.time,
          mealTime: food.mealTime,
          foods: [food],
          nutrition: food.nutrition || emptyNutrition(),
          canDelete: true,
        });
      });
      return;
    }
    entries.push({ ...meal, type: "meal", canDelete: false });
  });
  record.foodPhotos.forEach((meal) => {
    entries.push({ ...meal, type: "photo" });
  });
  const allEntries = entries;

  setText("[data-dashboard-meal-count]", `${allEntries.length} 餐`);
  timeline.innerHTML = slots
    .map((slot) => {
      const slotEntries = allEntries.filter((entry) => {
        if (entry.mealTime) {
          return entry.mealTime === slot.name;
        }
        return getMealSlot(entry.time) === slot.id;
      });
      const content =
        slotEntries.length > 0
          ? slotEntries
              .map((entry) => {
                const nutrition = entry.nutrition || emptyNutrition();
                return `
                  <div class="timeline-food">
                    <div>
                      <strong>${formatFoodNames(entry.foods)}</strong>
                      <span>${Math.round(nutrition.calories)} kcal · 蛋白质 ${Math.round(nutrition.proteinG)}g · 碳水 ${Math.round(nutrition.carbG)}g · 脂肪 ${Math.round(nutrition.fatG)}g</span>
                    </div>
                    ${
                      entry.canDelete
                        ? `<button class="text-button" type="button" data-delete-food-meal="${entry.mealId}" data-delete-food-index="${entry.foodIndex}">删除</button>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")
          : `<p class="timeline-empty">还没有记录</p>`;

      return `
        <article class="timeline-item">
          <div class="timeline-dot"></div>
          <div>
            <h3>${slot.name}</h3>
            ${content}
          </div>
        </article>
      `;
    })
    .join("");
}

function buildDailySummary(record, nutrition, calorieGoal) {
  const caloriePercent = getNutritionPercent(nutrition.calories, calorieGoal);
  const proteinPercent = getNutritionPercent(nutrition.proteinG, plan.proteinG);
  const carbPercent = getNutritionPercent(nutrition.carbG, plan.carbG);
  const fatPercent = getNutritionPercent(nutrition.fatG, plan.fatG);
  const hasFood = nutrition.calories > 0;
  const score = Math.min(
    100,
    Math.round(
      (Math.min(caloriePercent, 100) + Math.min(proteinPercent, 100) + calculateCompletion(record)) / 3
    )
  );

  if (!hasFood) {
    return {
      score: "--",
      completion: "今天还没有饮食记录，先记录一餐就能看到完整反馈。",
      nutrition: "暂无营养数据。",
      advice: "可以从最容易的一餐开始，例如输入“两个鸡蛋、一杯牛奶”。",
    };
  }

  let nutritionText = "整体记录稳定。";
  if (proteinPercent < 80) {
    nutritionText = `蛋白质完成 ${proteinPercent}%，距离目标还差一些。`;
  } else if (fatPercent > 120) {
    nutritionText = "脂肪摄入偏高，下一餐可以选择更清爽的做法。";
  } else if (carbPercent < 60) {
    nutritionText = "碳水偏低，适量米饭、面条或水果会更容易坚持。";
  }

  let advice = "继续保持记录，晚些时候根据剩余热量补足缺口。";
  if (caloriePercent >= 95) {
    advice = "今天热量接近目标，后续以低热量饮品或蔬菜为主。";
  } else if (proteinPercent < 80) {
    advice = "下一餐可以优先补充鸡蛋、虾仁、鸡腿、牛排或无糖酸奶。";
  }

  return {
    score: `${score}分`,
    completion: `今日热量完成 ${caloriePercent}%，已记录 ${record.meals.length + record.foodPhotos.length} 餐。`,
    nutrition: nutritionText,
    advice,
  };
}

function renderDashboard() {
  const todayRecord = findDailyRecord(todayText()) || createDailyRecord(todayText());
  const nutrition = todayRecord.nutritionTotals || emptyNutrition();
  const calorieGoal = plan.calories;
  const exerciseCalories = Number(todayRecord.exercise?.calories || 0);
  const netCalories = Math.max(nutrition.calories - exerciseCalories, 0);
  const caloriesLeft = calorieGoal - nutrition.calories;
  const caloriePercent = getNutritionPercent(nutrition.calories, calorieGoal);
  const summary = buildDailySummary(todayRecord, nutrition, calorieGoal);

  setText("[data-dashboard-calories-goal]", calorieGoal);
  setText("[data-dashboard-calories-in]", Math.round(nutrition.calories));
  setText("[data-dashboard-calories-left]", formatCalorieGap(nutrition.calories, calorieGoal));
  setText("[data-dashboard-net-calories]", Math.round(netCalories));
  setText("[data-dashboard-calorie-percent]", caloriePercent);
  setText("[data-dashboard-protein-in]", Math.round(nutrition.proteinG));
  setText("[data-dashboard-protein-goal]", plan.proteinG);
  setText("[data-dashboard-protein-left]", formatGap(nutrition.proteinG, plan.proteinG));
  setText("[data-dashboard-carb-in]", Math.round(nutrition.carbG));
  setText("[data-dashboard-carb-goal]", plan.carbG);
  setText("[data-dashboard-carb-left]", formatGap(nutrition.carbG, plan.carbG));
  setText("[data-dashboard-fat-in]", Math.round(nutrition.fatG));
  setText("[data-dashboard-fat-goal]", plan.fatG);
  setText("[data-dashboard-fat-left]", formatGap(nutrition.fatG, plan.fatG));
  setText("[data-dashboard-water]", `${todayRecord.water.amountL} L / ${todayRecord.water.targetL} L`);
  setText("[data-dashboard-exercise]", formatExercise(todayRecord.exercise));
  setText("[data-dashboard-bowel]", formatBowel(todayRecord.bowel));
  setText("[data-dashboard-weight]", todayRecord.weight.valueKg || activeProfile.currentWeightKg);
  setText("[data-dashboard-completion]", calculateCompletion(todayRecord));
  setText("[data-dashboard-record-status]", nutrition.calories > 0 ? "已记录饮食" : "待记录饮食");
  setText("[data-dashboard-summary-score]", summary.score);
  setText("[data-dashboard-summary-completion]", summary.completion);
  setText("[data-dashboard-summary-nutrition]", summary.nutrition);
  setText("[data-dashboard-summary-advice]", summary.advice);

  setProgress("[data-dashboard-calorie-progress]", nutrition.calories, calorieGoal);
  setProgress("[data-dashboard-protein-progress]", nutrition.proteinG, plan.proteinG);
  setProgress("[data-dashboard-carb-progress]", nutrition.carbG, plan.carbG);
  setProgress("[data-dashboard-fat-progress]", nutrition.fatG, plan.fatG);
  renderMealTimeline(todayRecord);
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fillDailyRecord(date) {
  const record = findDailyRecord(date);

  recordWeightInput.value = record?.weightKg || "";
  recordFoodInput.value = record?.foodNote || "";
  recordExerciseInput.value = record?.exercise?.note || record?.exerciseText || "";
  recordExerciseTypeInput.value = record?.exercise?.type || "none";
  recordExerciseMinutesInput.value = record?.exercise?.minutes || "";
  recordExerciseCaloriesInput.value = record?.exercise?.calories || "";
  recordBowelHasInput.value = record?.bowel?.hasBowel === true ? "yes" : record?.bowel?.hasBowel === false ? "no" : "";
  recordBowelStatusInput.value = record?.bowel?.status || "";
  recordBowelNoteInput.value = record?.bowel?.note || "";
  setText("[data-daily-record-status]", record ? "已保存" : "未保存");

  if (date === todayText()) {
    setText("[data-current-weight]", record?.weightKg || activeProfile.currentWeightKg);
  }
}

function renderWaterRecord() {
  const record = findDailyRecord(todayText()) || createDailyRecord(todayText());
  const water = record.water || createDailyRecord(todayText()).water;
  if (waterManualInput) {
    waterManualInput.value = water.amountL || "";
  }
  setText("[data-water-status]", `${water.amountL} L / ${water.targetL} L`);
  setText("[data-water-note]", water.amountL >= water.targetL ? "今日饮水已达标。" : "每日目标 2L，少量多次更容易完成。");
}

function renderTrends() {
  const records = readDailyRecords().slice(-7);
  const weightTrend = document.querySelector("[data-weight-trend]");
  const intakeTrend = document.querySelector("[data-intake-trend]");

  if (weightTrend) {
    const weightRecords = records.filter((record) => record.weight.valueKg);
    weightTrend.innerHTML =
      weightRecords.length > 0
        ? weightRecords
            .map(
              (record) => `
                <article class="trend-item">
                  <span>${record.date}</span>
                  <strong>${record.weight.valueKg} kg</strong>
                </article>
              `
            )
            .join("")
        : `<p class="notice">记录体重后会显示趋势。</p>`;
  }

  if (intakeTrend) {
    intakeTrend.innerHTML =
      records.length > 0
        ? records
            .map(
              (record) => `
                <article class="trend-item">
                  <span>${record.date}</span>
                  <strong>${Math.round(record.nutritionTotals.calories)} kcal</strong>
                </article>
              `
            )
            .join("")
        : `<p class="notice">记录饮食后会显示近 7 天摄入。</p>`;
  }
}

if (recordDateInput) {
  recordDateInput.value = todayText();
  fillDailyRecord(recordDateInput.value);

  recordDateInput.addEventListener("change", () => {
    fillDailyRecord(recordDateInput.value);
  });
}

function fillEstimatedExerciseCalories() {
  if (!recordExerciseTypeInput || !recordExerciseMinutesInput || !recordExerciseCaloriesInput) {
    return;
  }
  recordExerciseCaloriesInput.value = estimateExerciseCalories(
    recordExerciseTypeInput.value,
    recordExerciseMinutesInput.value
  );
}

if (recordExerciseTypeInput && recordExerciseMinutesInput) {
  recordExerciseTypeInput.addEventListener("change", fillEstimatedExerciseCalories);
  recordExerciseMinutesInput.addEventListener("input", fillEstimatedExerciseCalories);
}

renderProfileSummary();
renderDashboard();
renderWaterRecord();
renderTrends();

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;

    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    pages.forEach((page) => {
      page.classList.toggle("is-active", page.dataset.page === target);
    });
  });
});

function renderTextFoodAnalysis(result) {
  const resultPanel = document.querySelector("[data-text-food-result]");
  const itemList = document.querySelector("[data-text-food-items]");
  if (!resultPanel || !itemList) {
    return;
  }

  resultPanel.hidden = false;
  setText("[data-text-food-calories]", Math.round(result.nutrition.calories));
  setText("[data-text-food-protein]", Math.round(result.nutrition.proteinG));
  setText("[data-text-food-carb]", Math.round(result.nutrition.carbG));
  setText("[data-text-food-fat]", Math.round(result.nutrition.fatG));
  setText("[data-text-food-status]", result.note);
  const mealOrder = ["早餐", "午餐", "晚餐", "加餐", "饮品", "未分类饮食"];
  itemList.innerHTML = mealOrder
    .map((mealName) => {
      const foods = result.mealItems.filter((food) => food.mealTime === mealName);
      if (foods.length === 0 && !["早餐", "午餐", "晚餐"].includes(mealName)) {
        return "";
      }

      return `
        <li class="text-meal-group">
          <h5>${mealName}</h5>
          <div class="text-food-list">
            ${
              foods.length > 0
                ? foods
                    .map(
                      (food) => `
                  <article class="text-food-item">
                    <strong>${food.name}</strong>
                    <span>${food.quantity} · ${food.weight} · 可信度 ${food.confidence || "中"} · ${food.estimateNote || "估算值，可修改"}</span>
                    <span>${food.calories} kcal · 蛋白质 ${food.protein}g · 碳水 ${food.carbs}g · 脂肪 ${food.fat}g</span>
                  </article>
                `
                    )
                    .join("")
                : `<article class="text-food-item"><strong>无</strong><span>本餐未记录食物</span></article>`
            }
          </div>
        </li>
      `;
    })
    .join("");
}

function applyStatusFromText(input) {
  const date = todayText();
  const waterMatch = input.match(/(\d+(?:\.\d+)?)\s*(l|L|升|毫升|ml|ML)/);
  if (waterMatch) {
    const rawAmount = Number(waterMatch[1]);
    const unit = waterMatch[2].toLowerCase();
    const amountL = unit.includes("ml") || unit.includes("毫升") ? rawAmount / 1000 : rawAmount;
    updateWaterRecord(date, { amountL: Math.round(amountL * 100) / 100 });
  }

  if (/没有运动|无运动|没运动/.test(input)) {
    updateExerciseRecord(date, { type: "none", minutes: 0, calories: 0, note: "" });
  }

  if (/没有排便|无排便|没排便/.test(input)) {
    updateBowelRecord(date, { hasBowel: false, status: "", note: "" });
  } else if (/排便了|有排便|今天排便/.test(input)) {
    updateBowelRecord(date, { hasBowel: true, status: "正常" });
  }

  renderDashboard();
  renderWaterRecord();
  fillDailyRecord(date);
}

if (analyzeFoodTextButton) {
  analyzeFoodTextButton.addEventListener("click", async () => {
    const input = foodTextInput.value.trim();
    if (!input) {
      setText("[data-text-food-status]", "请先输入今天吃了什么。");
      return;
    }

    applyStatusFromText(input);
    analyzeFoodTextButton.disabled = true;
    setText("[data-text-food-status]", "正在联网分析饮食内容...");

    try {
      pendingTextFoodAnalysis = await analyzeFoodTextOnline(input);
      renderTextFoodAnalysis(pendingTextFoodAnalysis);
    } catch (error) {
      pendingTextFoodAnalysis = null;
      setText("[data-text-food-status]", `${error.message}。请确认已部署到 Vercel，并配置 OPENAI_API_KEY。`);
    } finally {
      analyzeFoodTextButton.disabled = false;
    }
  });
}

if (addTextFoodRecordButton) {
  addTextFoodRecordButton.addEventListener("click", () => {
    if (!pendingTextFoodAnalysis || pendingTextFoodAnalysis.mealItems.length === 0) {
      setText("[data-text-food-status]", "没有可加入的分析结果。");
      return;
    }

    addMealEntry(todayText(), {
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      source: "text",
      foods: pendingTextFoodAnalysis.foods,
      nutrition: pendingTextFoodAnalysis.nutrition,
    });
    setText("[data-text-food-status]", "已加入今日记录，首页 Dashboard 已更新。");
    foodTextInput.value = "";
    renderDashboard();
    renderTrends();
  });
}

if (foodPhotoInput) {
  foodPhotoInput.addEventListener("change", async () => {
    const file = foodPhotoInput.files[0];
    if (!file) {
      return;
    }

    pendingPhotoFoodAnalysis = null;
    const previewUrl = URL.createObjectURL(file);
    pendingFoodPhotoData = previewUrl;
    foodPreview.src = previewUrl;
    foodPreview.hidden = false;
    aiResult.hidden = false;
    setText("[data-food-name]", "识别中...");
    setText("[data-food-calories]", "--");
    setText("[data-food-protein]", "--");
    setText("[data-food-carb]", "--");
    setText("[data-food-fat]", "--");
    setText("[data-food-items]", "正在分析图片");
    setText("[data-food-weight]", "--");
    setText("[data-food-confidence]", "--");
    setText("[data-food-note]", "请稍等，正在估算食物热量。");

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      pendingFoodPhotoData = reader.result;
    });
    reader.readAsDataURL(file);

    const result = await mockRecognizeFood(file);
    pendingPhotoFoodAnalysis = result;
    setText("[data-food-name]", result.name);
    setText("[data-food-calories]", result.nutrition.calories);
    setText("[data-food-protein]", result.nutrition.proteinG);
    setText("[data-food-carb]", result.nutrition.carbG);
    setText("[data-food-fat]", result.nutrition.fatG);
    setText("[data-food-items]", result.items.join("、"));
    setText("[data-food-weight]", result.weight);
    setText("[data-food-confidence]", result.confidence);
    setText("[data-food-note]", result.note);
  });
}

if (addPhotoFoodRecordButton) {
  addPhotoFoodRecordButton.addEventListener("click", () => {
    if (!pendingPhotoFoodAnalysis) {
      setText("[data-food-note]", "请先上传或拍摄食物照片。");
      return;
    }

    addFoodPhotoEntry(todayText(), {
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      photo: pendingFoodPhotoData,
      foods: pendingPhotoFoodAnalysis.items.map((item) => ({
        name: item,
        amount: pendingPhotoFoodAnalysis.weight,
      })),
      confidence: pendingPhotoFoodAnalysis.confidence,
      nutrition: pendingPhotoFoodAnalysis.nutrition,
    });
    setText("[data-food-note]", "已加入今日记录，首页 Dashboard 已更新。");
    renderDashboard();
    renderTrends();
  });
}

const timeline = document.querySelector("[data-dashboard-meal-timeline]");
if (timeline) {
  timeline.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-food-meal]");
    if (!button) {
      return;
    }

    deleteFoodFromMeal(todayText(), button.dataset.deleteFoodMeal, Number(button.dataset.deleteFoodIndex));
    renderDashboard();
    renderTrends();
  });
}

waterAddButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const record = findDailyRecord(todayText()) || createDailyRecord(todayText());
    const amountL = Math.round((record.water.amountL + Number(button.dataset.waterAdd || 0)) * 100) / 100;
    updateWaterRecord(todayText(), { amountL });
    renderWaterRecord();
    renderDashboard();
  });
});

if (saveWaterButton) {
  saveWaterButton.addEventListener("click", () => {
    updateWaterRecord(todayText(), { amountL: Number(waterManualInput.value || 0) });
    renderWaterRecord();
    renderDashboard();
  });
}

if (saveDailyRecordButton) {
  saveDailyRecordButton.addEventListener("click", () => {
    const date = recordDateInput.value || todayText();
    const hasBowelValue = recordBowelHasInput.value;

    upsertDailyRecord({
      date,
      weight: {
        valueKg: recordWeightInput.value,
      },
      notes: {
        food: recordFoodInput.value.trim(),
        exercise: recordExerciseInput.value.trim(),
      },
      exercise: {
        type: recordExerciseTypeInput.value,
        minutes: Number(recordExerciseMinutesInput.value || 0),
        calories: Number(recordExerciseCaloriesInput.value || 0),
        note: recordExerciseInput.value.trim(),
      },
      bowel: {
        hasBowel: hasBowelValue === "" ? null : hasBowelValue === "yes",
        status: recordBowelStatusInput.value,
        note: recordBowelNoteInput.value.trim(),
      },
      updatedAt: new Date().toISOString(),
    });

    setText("[data-daily-record-status]", "已保存");
    renderTrends();
    if (date === todayText()) {
      setText("[data-current-weight]", recordWeightInput.value || activeProfile.currentWeightKg);
      renderDashboard();
    }
  });
}

if (saveProfileButton) {
  saveProfileButton.addEventListener("click", () => {
    const nextProfile = {
      ...activeProfile,
      gender: profileInputs.gender.value,
      age: Number(profileInputs.age.value || activeProfile.age),
      heightCm: Number(profileInputs.heightCm.value || activeProfile.heightCm),
      currentWeightKg: Number(profileInputs.currentWeightKg.value || activeProfile.currentWeightKg),
      targetWeightKg: Number(profileInputs.targetWeightKg.value || activeProfile.targetWeightKg),
      targetDays: Number(profileInputs.targetDays.value || activeProfile.targetDays),
      activityLevel: profileInputs.activityLevel.value,
    };
    saveUserProfile(nextProfile);
    renderProfileSummary();
    renderDashboard();
    setText("[data-profile-status]", "已保存");
  });
}
