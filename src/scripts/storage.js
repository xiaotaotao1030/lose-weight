const dailyRecordStoreKey = "light-plan-v1-daily-records";
const legacyDailyRecordStoreKey = "light-plan-daily-records";

function emptyNutrition() {
  return {
    calories: 0,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
  };
}

function createDailyRecord(date) {
  return {
    date,
    meals: [],
    foodPhotos: [],
    nutritionTotals: emptyNutrition(),
    exercise: {
      type: "none",
      minutes: 0,
      calories: 0,
      note: "",
    },
    weight: {
      valueKg: "",
    },
    bowel: {
      hasBowel: null,
      status: "",
      note: "",
    },
    legacy: {
      food: "",
      exercise: "",
    },
    updatedAt: "",
  };
}

function sumNutrition(entries) {
  return entries.reduce((total, entry) => {
    const nutrition = entry.nutrition || emptyNutrition();
    return {
      calories: total.calories + Number(nutrition.calories || 0),
      proteinG: total.proteinG + Number(nutrition.proteinG || 0),
      carbG: total.carbG + Number(nutrition.carbG || 0),
      fatG: total.fatG + Number(nutrition.fatG || 0),
    };
  }, emptyNutrition());
}

function normalizeDailyRecord(record) {
  const normalized = {
    ...createDailyRecord(record.date),
    ...record,
  };

  normalized.meals = record.meals || [];
  normalized.foodPhotos = record.foodPhotos || [];
  normalized.weight = {
    valueKg: record.weight?.valueKg || record.weightKg || "",
  };
  normalized.exercise = {
    ...createDailyRecord(record.date).exercise,
    ...(record.exercise && typeof record.exercise === "object" ? record.exercise : {}),
    note: typeof record.exercise === "string" ? record.exercise : record.exercise?.note || "",
  };
  normalized.bowel = {
    ...createDailyRecord(record.date).bowel,
    ...(record.bowel || {}),
  };
  normalized.legacy = {
    food: record.legacy?.food || record.food || "",
    exercise: record.legacy?.exercise || (typeof record.exercise === "string" ? record.exercise : ""),
  };
  normalized.nutritionTotals = sumNutrition([...normalized.meals, ...normalized.foodPhotos]);

  return {
    ...normalized,
    weightKg: normalized.weight.valueKg,
    food: normalized.legacy.food,
    exercise: normalized.legacy.exercise || normalized.exercise.note,
  };
}

function readJson(key) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : [];
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readDailyRecords() {
  const records = readJson(dailyRecordStoreKey);
  if (records.length > 0) {
    return records.map(normalizeDailyRecord);
  }

  const legacyRecords = readJson(legacyDailyRecordStoreKey);
  if (legacyRecords.length === 0) {
    return [];
  }

  const migratedRecords = legacyRecords.map(normalizeDailyRecord);
  saveDailyRecords(migratedRecords);
  return migratedRecords;
}

function saveDailyRecords(records) {
  const normalizedRecords = records.map(normalizeDailyRecord);
  writeJson(dailyRecordStoreKey, normalizedRecords);
}

function findDailyRecord(date) {
  return readDailyRecords().find((record) => record.date === date);
}

function upsertDailyRecord(record) {
  const existing = findDailyRecord(record.date) || createDailyRecord(record.date);
  const merged = normalizeDailyRecord({
    ...existing,
    ...record,
    weight: {
      ...existing.weight,
      ...(record.weight || {}),
      valueKg: record.weight?.valueKg || record.weightKg || existing.weight?.valueKg || "",
    },
    legacy: {
      ...existing.legacy,
      ...(record.legacy || {}),
      food: record.legacy?.food || record.food || existing.legacy?.food || "",
      exercise:
        record.legacy?.exercise ||
        (typeof record.exercise === "string" ? record.exercise : existing.legacy?.exercise || ""),
    },
    updatedAt: record.updatedAt || new Date().toISOString(),
  });
  const records = readDailyRecords().filter((item) => item.date !== record.date);
  records.push(merged);
  records.sort((a, b) => a.date.localeCompare(b.date));
  saveDailyRecords(records);
  return records;
}

function addMealEntry(date, meal) {
  const record = findDailyRecord(date) || createDailyRecord(date);
  return upsertDailyRecord({
    ...record,
    meals: [
      ...record.meals,
      {
        id: `meal-${Date.now()}`,
        time: meal.time || "",
        source: meal.source || "text",
        foods: meal.foods || [],
        nutrition: meal.nutrition || emptyNutrition(),
      },
    ],
  });
}

function addFoodPhotoEntry(date, entry) {
  const record = findDailyRecord(date) || createDailyRecord(date);
  return upsertDailyRecord({
    ...record,
    foodPhotos: [
      ...record.foodPhotos,
      {
        id: `photo-${Date.now()}`,
        time: entry.time || "",
        photo: entry.photo || "",
        foods: entry.foods || [],
        confidence: entry.confidence || 0,
        nutrition: entry.nutrition || emptyNutrition(),
      },
    ],
  });
}

function updateExerciseRecord(date, exercise) {
  const record = findDailyRecord(date) || createDailyRecord(date);
  return upsertDailyRecord({
    ...record,
    exercise: {
      ...record.exercise,
      ...exercise,
    },
  });
}

function updateWeightRecord(date, valueKg) {
  const record = findDailyRecord(date) || createDailyRecord(date);
  return upsertDailyRecord({
    ...record,
    weight: {
      valueKg,
    },
  });
}

function updateBowelRecord(date, bowel) {
  const record = findDailyRecord(date) || createDailyRecord(date);
  return upsertDailyRecord({
    ...record,
    bowel: {
      ...record.bowel,
      ...bowel,
    },
  });
}
