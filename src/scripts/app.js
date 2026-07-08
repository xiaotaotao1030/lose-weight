const tabs = document.querySelectorAll(".tab-item");
const pages = document.querySelectorAll(".page");
const checkButtons = document.querySelectorAll(".check-dot");
const foodPhotoInput = document.querySelector("#food-photo");
const foodPreview = document.querySelector("[data-food-preview]");
const aiResult = document.querySelector("[data-ai-result]");
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
const plan = calculatePlan(userProfile);
let selectedTaste = localStorage.getItem(tasteStoreKey) || "chinese";
let selectedMealMode = localStorage.getItem(mealModeStoreKey) || "twoMeal";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js");
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

if (foodPhotoInput) {
  foodPhotoInput.addEventListener("change", async () => {
    const file = foodPhotoInput.files[0];
    if (!file) {
      return;
    }

    foodPreview.src = URL.createObjectURL(file);
    foodPreview.hidden = false;
    aiResult.hidden = false;
    setText("[data-food-name]", "识别中...");
    setText("[data-food-calories]", "--");
    setText("[data-food-items]", "正在分析图片");
    setText("[data-food-confidence]", "--");
    setText("[data-food-note]", "请稍等，正在估算食物热量。");

    const result = await mockRecognizeFood(file);
    setText("[data-food-name]", result.name);
    setText("[data-food-calories]", result.calories);
    setText("[data-food-items]", result.items.join("、"));
    setText("[data-food-confidence]", result.confidence);
    setText("[data-food-note]", result.note);
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
    }
  });
}

reportTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    reportTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    renderBodyReport(Number(tab.dataset.reportDays));
  });
});
