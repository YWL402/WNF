# 窝囊废Desk - 实时工资计算器

一个简单而优雅的桌面小工具，帮助你实时查看工作时间内的收入情况。

![预览图](./icon.png)

## ✨ 特性

- 🕒 实时计算工作时间内的收入
- 💰 支持自定义月薪设置
- ⏰ 可配置工作时间和午休时间
- 📅 灵活的工作日设置
- 🎯 支持托盘最小化
- 🖱️ 支持拖拽和调整大小
- 💫 平滑的动画效果
- 🎨 现代化UI设计

## 📥 下载安装

### 便携版 (推荐)
1. 从 [Releases页面](../../releases) 下载 `窝囊废Desk-portable.zip`
2. 解压到任意位置
3. 确保已安装 [Node.js](https://nodejs.org/)
4. 双击 `启动.bat` 即可运行

### Windows用户 (完整版)
1. 下载最新版本的安装包 (.exe)
2. 双击运行安装程序
3. 根据向导完成安装
4. 从开始菜单或桌面快捷方式启动

### macOS用户
1. 下载最新版本的 .dmg 文件
2. 打开 .dmg 文件
3. 将应用拖入 Applications 文件夹
4. 从启动台或 Applications 文件夹启动

### Linux用户
1. 下载最新版本的 .AppImage 文件
2. 添加执行权限：`chmod +x 窝囊废Desk.AppImage`
3. 双击或命令行运行

## 🚀 开发指南

如果您想参与开发，可以按照以下步骤设置开发环境：

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. 克隆仓库
```bash
git clone <your-repository-url>
cd 窝囊废Desk
```

2. 安装依赖
```bash
npm install
```

3. 启动应用
```bash
npm start
```

### 打包应用

#### 便携版打包 (推荐，无需网络)
```bash
npm run build:portable
```
生成的便携版位于 `dist/窝囊废Desk-portable/` 目录。

#### 完整版打包 (需要网络连接)
```bash
# 打包所有平台
npm run build

# 仅打包Windows版本
npm run build:win

# 仅打包macOS版本
npm run build:mac

# 仅打包Linux版本
npm run build:linux
```

打包后的文件将在 `dist` 目录下生成。

**注意**：完整版打包需要稳定的网络连接来下载依赖。如果遇到网络问题，建议使用便携版打包方式。

## 📝 使用说明

1. 首次启动时，点击托盘图标中的"工资设置"进行配置
2. 设置您的月薪、工作时间、午休时间和工作日
3. 保存配置后，主窗口将自动显示实时收入计算
4. 可以通过拖拽窗口调整位置，通过右下角调整窗口大小
5. 点击窗口可以快速隐藏，通过托盘图标可以再次显示

## ⚙️ 配置说明

### 工资设置
- 月薪：设置您的税前月薪
- 工作时间：设置每天的上下班时间
- 午休时间：设置午休的开始和结束时间
- 工作日：选择每周的工作日（默认周一至周五）

### 显示设置
- 窗口可以自由拖拽
- 支持调整窗口大小
- 始终保持在最顶层显示
- 支持透明效果

## 🛠️ 技术栈

- Electron
- HTML/CSS/JavaScript
- Node.js

## 📄 许可证

[MIT License](LICENSE)

## 🤝 贡献

欢迎提交问题和改进建议！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 🔄 更新日志

### v1.0.0
- 初始版本发布
- 实现基本的工资计算功能
- 支持自定义工作时间设置
- 添加托盘图标支持
- 实现窗口拖拽和大小调整

## 👨‍💻 作者

作者名字 - [GitHub主页](<your-github-url>)

## 🙏 鸣谢

- Electron - 跨平台桌面应用开发框架
- Node.js - JavaScript 运行时
- 所有贡献者和用户 