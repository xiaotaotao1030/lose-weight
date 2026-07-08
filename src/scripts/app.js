const tabs = document.querySelectorAll(".tab-item");
const pages = document.querySelectorAll(".page");
const checkButtons = document.querySelectorAll(".check-dot");
const foodPhotoInput = document.querySelector("#food-photo");
const foodPreview = document.querySelector("[data-food-preview]");
const aiResult = document.querySelector("[data-ai-result]");
const foodTextInput = document.querySelector("[data-food-text-input]");
const analyzeFoodTextButton = document.querySelector("[data-analyze-food-text]");
const addTextFoodRecordButton = document.querySelector("[data-add-text-food-record]");
const addPhotoFoodRecordButton = document.querySelector("[data-add-photo-food-record]");
const bodyDateInput = document.querySelector("[data-body-date]");
const bodyPhotoInput = document.querySelector("#body-photo");
const bodyPreview = document.querySelector("[data-body-preview]");
const saveBodyButton = document.querySelector("[data-save-body-checkin]");
const reportTabs = document.querySelectorAll(".report-tab");
const recordDateInput = document.querySelector("[data-record-date]");
const recordWeightInput = document.querySelector("[data-record-weight]");
const recordFoodInput = document.querySelector("[data-record-food]");
const recordExerciseInput = document.querySelector("[data-record-exercise]");
const saveDailyRecordButton = document.querySelector("[data-save-daily-record]");
const mealPlanContainer = document.querySelector("[data-meal-plan]");
const tasteOptionsContainer = document.querySelector("[data-taste-options]");
const mealModeOptionsContainer = document.querySelector("[data-meal-mode-options]");
const tasteStoreKey = "light-plan-taste-preference";
const mealModeStoreKey = "light-plan-meal-mode";
let bodyPhotoData = "";
let pendingTextFoodAnalysis = null;
let pendingPhotoFoodAnalysis = null;
let pendingFoodPhotoData = "";
const plan = calculatePlan(userProfile);
let selectedTaste = localStorage.getItem(tasteStoreKey) || "chinese";
let selectedMealMode = localStorage.getItem(mealModeStoreKey) || "twoMeal";

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

setText("[data-current-weight]", userProfile.currentWeightKg);
setText("[data-target-weight]", userProfile.targetWeightKg);
setText("[data-goal-label]", `${userProfile.targetDays} 天目标`);
setText("[data-bmi]", plan.bmi);
setText("[data-bmr]", plan.bmr);
setText("[data-calories]", plan.calories);
setText("[data-deficit]", plan.dailyDeficit);
setText(
  "[data-goal-notice]",
  plan.isAggressiveGoal
    ? `3 个月减 12kg 偏快，原目标需要每日约 ${plan.targetDailyDeficit} kcal 缺口。当前算法先按每日 ${plan.dailyDeficit} kcal 缺口计算，预计 90 天到 ${plan.expectedWeightKg}kg 左右。`
    : "当前目标节奏合理，可以按计划执行并根据体重变化微调。"
);

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
    return "未运动";
  }

  const typeMap = {
    walk: "步行",
    run: "跑步",
    gym: "健身",
    other: "其他",
  };
  return `${typeMap[exercise.type] || exercise.type} ${exercise.minutes || 0} 分钟`;
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
    if (meal.foods?.some((food) => food.mealTime)) {
      meal.foods.forEach((food) => {
        entries.push({
          id: `${meal.id}-${food.name}`,
          time: meal.time,
          mealTime: food.mealTime,
          foods: [food],
          nutrition: food.nutrition || emptyNutrition(),
        });
      });
      return;
    }
    entries.push({ ...meal, type: "meal" });
  });
  record.foodPhotos.forEach((meal) => {
    entries.push({ ...meal, type: "photo" });
  });
  const legacyFood = record.legacy?.food
    ? [
        {
          id: "legacy-food",
          time: "",
          type: "legacy",
          foods: [{ name: record.legacy.food, amount: "" }],
          nutrition: emptyNutrition(),
        },
      ]
    : [];
  const allEntries = [...entries, ...legacyFood];

  setText("[data-dashboard-meal-count]", `${allEntries.length} 餐`);
  timeline.innerHTML = slots
    .map((slot) => {
      const slotEntries = allEntries.filter((entry) => {
        if (entry.type === "legacy") {
          return slot.id === "breakfast";
        }
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
                    <strong>${formatFoodNames(entry.foods)}</strong>
                    <span>${Math.round(nutrition.calories)} kcal · 蛋白质 ${Math.round(nutrition.proteinG)}g · 碳水 ${Math.round(nutrition.carbG)}g · 脂肪 ${Math.round(nutrition.fatG)}g</span>
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
    advice = "下一餐优先补充鸡蛋、虾仁、鸡腿、牛排或无糖酸奶。";
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
  const caloriesLeft = Math.max(calorieGoal - nutrition.calories, 0);
  const caloriePercent = getNutritionPercent(nutrition.calories, calorieGoal);
  const summary = buildDailySummary(todayRecord, nutrition, calorieGoal);

  setText("[data-dashboard-calories-goal]", calorieGoal);
  setText("[data-dashboard-calories-in]", Math.round(nutrition.calories));
  setText("[data-dashboard-calories-left]", Math.round(caloriesLeft));
  setText("[data-dashboard-calorie-percent]", caloriePercent);
  setText("[data-dashboard-protein-in]", Math.round(nutrition.proteinG));
  setText("[data-dashboard-protein-goal]", plan.proteinG);
  setText("[data-dashboard-carb-in]", Math.round(nutrition.carbG));
  setText("[data-dashboard-carb-goal]", plan.carbG);
  setText("[data-dashboard-fat-in]", Math.round(nutrition.fatG));
  setText("[data-dashboard-fat-goal]", plan.fatG);
  setText("[data-dashboard-exercise]", formatExercise(todayRecord.exercise));
  setText("[data-dashboard-bowel]", formatBowel(todayRecord.bowel));
  setText("[data-dashboard-weight]", todayRecord.weight.valueKg || userProfile.currentWeightKg);
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

function renderBodyReport(days = 30) {
  const checkins = readBodyCheckins();
  const latest = checkins[checkins.length - 1];
  const report = buildChangeReport(days, checkins, userProfile, plan);
  const game = buildGamification(checkins, userProfile, plan, todayText());
  const latestPhoto = document.querySelector("[data-latest-body-photo]");
  const emptyPhoto = document.querySelector("[data-empty-body-photo]");
  const achievementList = document.querySelector("[data-achievement-list]");

  setText("[data-body-count]", checkins.length);
  setText("[data-report-weight]", report.estimatedWeight);
  setText("[data-report-loss]", report.plannedLossKg);
  setText("[data-report-summary]", report.summary);
  setText("[data-latest-body-date]", latest ? latest.date : "暂无");
  setText("[data-streak-days]", game.streak);
  setText("[data-points]", game.points);
  setText(
    "[data-achievement-count]",
    `${game.achievements.filter((item) => item.unlocked).length} / ${game.achievements.length}`
  );

  if (achievementList) {
    achievementList.innerHTML = game.achievements
      .map(
        (item) => `
          <article class="achievement-item ${item.unlocked ? "is-unlocked" : ""}">
            <strong>${item.unlocked ? "已达成" : "未达成"} · ${item.name}</strong>
            <span>${item.detail}</span>
          </article>
        `
      )
      .join("");
  }

  if (latest && latest.photo) {
    latestPhoto.src = latest.photo;
    latestPhoto.hidden = false;
    emptyPhoto.hidden = true;
  } else {
    latestPhoto.hidden = true;
    emptyPhoto.hidden = false;
  }
}

function renderMealPlan() {
  if (!mealPlanContainer) {
    return;
  }

  const activeTaste = tastePreferences.find((taste) => taste.id === selectedTaste) || tastePreferences[0];
  const activeMode = mealPlanModes.find((mode) => mode.id === selectedMealMode) || mealPlanModes[0];
  const mealPlans = {
    standard: dailyMealPlan,
    twoMeal: twoMealPlan,
    lazy: lazyMealPlan,
  };
  const meals = mealPlans[selectedMealMode] || twoMealPlan;
  const mealSummary = summarizeMealPlan(meals);

  setText("[data-taste-name]", activeTaste.name);
  setText("[data-meal-mode-name]", activeMode.name);
  setText("[data-meal-mode-notice]", mealModeNotices[selectedMealMode] || mealModeNotices.twoMeal);
  setText("[data-meal-calories]", mealSummary.calories);
  setText("[data-protein]", mealSummary.proteinG);
  setText("[data-carb]", mealSummary.carbG);
  setText("[data-fat]", mealSummary.fatG);

  mealPlanContainer.innerHTML = meals
    .map(
      (meal) => `
        <article class="meal-card">
          <div class="meal-card-header">
            <div>
              <span class="label">${meal.name}</span>
              <h3>${meal.time}</h3>
            </div>
            <strong>${meal.calories} kcal</strong>
          </div>
          <div class="nutrition-row">
            <span>蛋白质 ${meal.proteinG}g</span>
            <span>碳水 ${meal.carbG}g</span>
            <span>脂肪 ${meal.fatG}g</span>
          </div>
          <div class="meal-block">
            <h4>食材克数</h4>
            <ul>
              ${meal.ingredients.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </div>
          <div class="meal-block">
            <h4>好吃做法</h4>
            <p>${meal.methods[selectedTaste] || meal.methods.chinese}</p>
          </div>
          <div class="meal-block">
            <h4>替换食材</h4>
            <div class="swap-list">
              ${meal.swaps.map((item) => `<span>${item}</span>`).join("")}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMealModeOptions() {
  if (!mealModeOptionsContainer) {
    return;
  }

  mealModeOptionsContainer.innerHTML = mealPlanModes
    .map(
      (mode) => `
        <button class="taste-option ${mode.id === selectedMealMode ? "is-active" : ""}" type="button" data-meal-mode-id="${mode.id}">
          ${mode.name}
        </button>
      `
    )
    .join("");
}

function renderTasteOptions() {
  if (!tasteOptionsContainer) {
    return;
  }

  tasteOptionsContainer.innerHTML = tastePreferences
    .map(
      (taste) => `
        <button class="taste-option ${taste.id === selectedTaste ? "is-active" : ""}" type="button" data-taste-id="${taste.id}">
          ${taste.name}
        </button>
      `
    )
    .join("");
}

if (bodyDateInput) {
  bodyDateInput.value = todayText();
}

function fillDailyRecord(date) {
  const record = findDailyRecord(date);

  recordWeightInput.value = record?.weightKg || "";
  recordFoodInput.value = record?.food || "";
  recordExerciseInput.value = record?.exercise || "";
  setText("[data-daily-record-status]", record ? "已保存" : "未保存");

  if (date === todayText()) {
    setText("[data-current-weight]", record?.weightKg || userProfile.currentWeightKg);
  }
}

if (recordDateInput) {
  recordDateInput.value = todayText();
  fillDailyRecord(recordDateInput.value);

  recordDateInput.addEventListener("change", () => {
    fillDailyRecord(recordDateInput.value);
  });
}

renderBodyReport();
renderDashboard();
renderMealModeOptions();
renderTasteOptions();
renderMealPlan();

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;

    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    pages.forEach((page) => {
      page.classList.toggle("is-active", page.dataset.page === target);
    });
  });
});

checkButtons.forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("is-done");
  });
});

if (tasteOptionsContainer) {
  tasteOptionsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-taste-id]");
    if (!button) {
      return;
    }

    selectedTaste = button.dataset.tasteId;
    localStorage.setItem(tasteStoreKey, selectedTaste);
    renderTasteOptions();
    renderMealPlan();
  });
}

if (mealModeOptionsContainer) {
  mealModeOptionsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-meal-mode-id]");
    if (!button) {
      return;
    }

    selectedMealMode = button.dataset.mealModeId;
    localStorage.setItem(mealModeStoreKey, selectedMealMode);
    renderMealModeOptions();
    renderMealPlan();
  });
}

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
  const mealOrder = ["早餐", "午餐", "晚餐", "零食", "饮品"];
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
                    <span>${food.quantity} · ${food.weight} · ${food.estimateNote || "估算值，可修改"}</span>
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

if (analyzeFoodTextButton) {
  analyzeFoodTextButton.addEventListener("click", async () => {
    const input = foodTextInput.value.trim();
    if (!input) {
      setText("[data-text-food-status]", "请先输入今天吃了什么。");
      return;
    }

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
  });
}

if (bodyPhotoInput) {
  bodyPhotoInput.addEventListener("change", () => {
    const file = bodyPhotoInput.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      bodyPhotoData = reader.result;
      bodyPreview.src = bodyPhotoData;
      bodyPreview.hidden = false;
      saveBodyButton.disabled = false;
      setText("[data-body-save-status]", "照片已选择，可以保存今日打卡。");
    });
    reader.readAsDataURL(file);
  });
}

if (saveBodyButton) {
  saveBodyButton.addEventListener("click", () => {
    if (!bodyPhotoData) {
      return;
    }

    upsertBodyCheckin({
      date: bodyDateInput.value || todayText(),
      photo: bodyPhotoData,
    });
    setText("[data-body-save-status]", "今日身体照片已保存。");
    saveBodyButton.disabled = true;
    renderBodyReport();
  });
}

if (saveDailyRecordButton) {
  saveDailyRecordButton.addEventListener("click", () => {
    const date = recordDateInput.value || todayText();

    upsertDailyRecord({
      date,
      weightKg: recordWeightInput.value,
      food: recordFoodInput.value.trim(),
      exercise: recordExerciseInput.value.trim(),
      updatedAt: new Date().toISOString(),
    });

    setText("[data-daily-record-status]", "已保存");
    if (date === todayText()) {
      setText("[data-current-weight]", recordWeightInput.value || userProfile.currentWeightKg);
      renderDashboard();
    }
  });
}

reportTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    reportTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    renderBodyReport(Number(tab.dataset.reportDays));
  });
});
