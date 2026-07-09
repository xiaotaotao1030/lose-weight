# 轻盈计划

一款简单实用的个人减脂记录工具。重点不是推荐固定食谱，而是记录用户实际吃了什么，并反馈今天的热量、蛋白质、碳水和脂肪还剩多少。

## 技术方案

- 纯 HTML / CSS / JavaScript
- Vercel Serverless API 调用 OpenAI
- 浏览器本地存储每日记录
- 移动端优先，兼容 iPhone Safari

## 目录结构

```text
.
├── api
│   └── analyze-food.js
├── index.html
├── manifest.json
├── sw.js
├── assets
│   └── app-icon.svg
├── src
│   ├── scripts
│   │   ├── app.js
│   │   ├── calculator.js
│   │   ├── food-ai.js
│   │   └── storage.js
│   └── styles
│       └── base.css
```

## 当前功能

- 基础信息录入：性别、年龄、身高、当前体重、目标体重、目标周期、活动水平
- 自动计算 BMI、BMR、每日推荐摄入热量和三大营养素目标
- 首页 Dashboard 展示今日热量、净摄入、剩余/超出热量、三大营养素缺口
- AI 文字饮食分析：前端请求 `/api/analyze-food`，后端读取 `OPENAI_API_KEY` 调用 OpenAI
- 食物图片上传入口：支持拍摄或相册上传，前端转 base64 后请求 `/api/analyze-image`
- 今日饮食时间轴：按早餐、午餐、晚餐展示食物，可删除单条食物记录
- 饮水打卡：+250ml、+500ml、+1L、手动输入
- 排便打卡：有 / 无，支持简单状态
- 运动记录：无运动、步行、跑步、力量训练、瑜伽、骑行、其他
- 体重趋势和近 7 天摄入趋势
- 本地存储，下次打开保留数据

## 已删除旧功能

- 一日三餐推荐
- 两餐制推荐菜单
- 懒人版菜单
- 固定食谱推荐
- 计划模式切换
- 口味偏好生成做法
- 身体照片打卡
- 30 / 60 / 90 天身体照片报告
- 打卡积分和减脂成就

## AI 功能说明

AI 饮食分析必须部署到 Vercel 或使用可访问 `/api` 的本地服务。直接用 `file://` 打开 `index.html` 时，浏览器无法调用 Vercel Serverless API。

Vercel 环境变量：

```text
OPENAI_API_KEY=YOUR_API_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
```

后端接口：`POST /api/analyze-food`

图片接口：`POST /api/analyze-image`

返回结构：

```json
{
  "mealName": "午餐",
  "foods": [
    {
      "name": "牛肉面",
      "quantity": "1碗",
      "estimatedWeight": "约500g",
      "calories": 650,
      "protein": 30,
      "carbs": 85,
      "fat": 18,
      "confidence": "中"
    }
  ],
  "mealTotal": {
    "calories": 650,
    "protein": 30,
    "carbs": 85,
    "fat": 18
  },
  "summary": "本餐为估算值，可根据实际份量修改。"
}
```

## 添加到手机主屏幕

`manifest.json` 保留用于主屏幕图标和 standalone 显示。当前不注册 service worker，不提供离线缓存，避免 iPhone 主屏幕版本读取旧缓存。
