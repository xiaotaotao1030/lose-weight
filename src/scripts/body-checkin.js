const bodyCheckinStoreKey = "light-plan-body-checkins";

function readBodyCheckins() {
  const saved = localStorage.getItem(bodyCheckinStoreKey);
  return saved ? JSON.parse(saved) : [];
}

function saveBodyCheckins(checkins) {
  localStorage.setItem(bodyCheckinStoreKey, JSON.stringify(checkins));
}

function upsertBodyCheckin(checkin) {
  const checkins = readBodyCheckins().filter((item) => item.date !== checkin.date);
  checkins.push(checkin);
  checkins.sort((a, b) => a.date.localeCompare(b.date));
  saveBodyCheckins(checkins);
  return checkins;
}

function buildChangeReport(days, checkins, profile, plan) {
  const plannedLossKg = Math.min((plan.dailyDeficit * days) / 7700, profile.currentWeightKg - profile.targetWeightKg);
  const estimatedWeight = profile.currentWeightKg - plannedLossKg;
  const photoCount = Math.min(checkins.length, days);

  return {
    days,
    photoCount,
    estimatedWeight: Math.round(estimatedWeight * 10) / 10,
    plannedLossKg: Math.round(plannedLossKg * 10) / 10,
    summary:
      photoCount === 0
        ? "还没有身体照片记录，先从今天开始打卡。"
        : `已记录 ${photoCount} 张身体变化照片，建议固定光线、角度和时间继续对比。`,
  };
}

function countCheckinStreak(checkins, today) {
  const dates = new Set(checkins.map((item) => item.date));
  const cursor = new Date(`${today}T00:00:00`);
  let streak = 0;

  while (dates.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildGamification(checkins, profile, plan, today) {
  const streak = countCheckinStreak(checkins, today);
  const points = checkins.length * 10 + streak * 5;
  const expectedLossKg = Math.round(((profile.currentWeightKg - plan.expectedWeightKg) * 10)) / 10;

  return {
    streak,
    points,
    achievements: [
      {
        name: "开始记录",
        unlocked: checkins.length >= 1,
        detail: "完成第一次身体照片打卡",
      },
      {
        name: "连续 3 天",
        unlocked: streak >= 3,
        detail: "连续 3 天完成身体变化记录",
      },
      {
        name: "连续 7 天",
        unlocked: streak >= 7,
        detail: "连续 7 天保持记录节奏",
      },
      {
        name: "预计减重 3kg",
        unlocked: expectedLossKg >= 3,
        detail: "当前计划预计可达成 3kg 阶段变化",
      },
      {
        name: "预计减重 5kg",
        unlocked: expectedLossKg >= 5,
        detail: "当前计划预计可达成 5kg 阶段变化",
      },
    ],
  };
}
