const dailyRecordStoreKey = "light-plan-daily-records";

function readDailyRecords() {
  const saved = localStorage.getItem(dailyRecordStoreKey);
  return saved ? JSON.parse(saved) : [];
}

function saveDailyRecords(records) {
  localStorage.setItem(dailyRecordStoreKey, JSON.stringify(records));
}

function findDailyRecord(date) {
  return readDailyRecords().find((record) => record.date === date);
}

function upsertDailyRecord(record) {
  const records = readDailyRecords().filter((item) => item.date !== record.date);
  records.push(record);
  records.sort((a, b) => a.date.localeCompare(b.date));
  saveDailyRecords(records);
  return records;
}
