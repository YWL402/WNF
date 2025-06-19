const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 简单的打包脚本
async function buildApp() {
    console.log('开始创建便携版应用...');
    
    try {
        // 创建dist目录
        const distDir = path.join(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir);
        }
        
        // 创建应用目录
        const appDir = path.join(distDir, 'WNF-portable');
        if (fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true, force: true });
        }
        fs.mkdirSync(appDir);
        
        // 复制主要文件
        const filesToCopy = [
            'main.js',
            'index.html',
            'settings.html',
            'renderer.js',
            'settings.js',
            'icon.png',
            'package.json'
        ];
        
        filesToCopy.forEach(file => {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(appDir, file));
                console.log(`已复制: ${file}`);
            }
        });
        
        // 复制node_modules中的必要依赖
        const nodeModulesDir = path.join(appDir, 'node_modules');
        fs.mkdirSync(nodeModulesDir);
        
        // 只复制运行时需要的模块
        const requiredModules = ['electron-store'];
        requiredModules.forEach(module => {
            const srcPath = path.join(__dirname, 'node_modules', module);
            const destPath = path.join(nodeModulesDir, module);
            if (fs.existsSync(srcPath)) {
                copyDir(srcPath, destPath);
                console.log(`已复制模块: ${module}`);
            }
        });
        
        // 创建启动脚本
        const startScript = `@echo off
echo 正在启动WNF...
cd /d "%~dp0"
npx electron . 2>nul
if errorlevel 1 (
    echo 请确保已安装 Node.js 和 npm
    echo 您可以从 https://nodejs.org/ 下载安装
    pause
)`;
        
        fs.writeFileSync(path.join(appDir, '启动.bat'), startScript);
        
        // 创建README
        const readme = `# WNF - 便携版

## 使用说明

1. 确保您的系统已安装 Node.js (https://nodejs.org/)
2. 双击 "启动.bat" 运行应用
3. 首次使用请设置您的工资信息

## 文件说明

- 启动.bat: 启动应用
- main.js: 主进程文件
- *.html: 界面文件
- *.css: 样式文件
- *.js: 脚本文件
- icon.png: 应用图标

如果遇到问题，请确保：
1. 已安装 Node.js
2. 网络连接正常
3. 没有杀毒软件阻止运行
`;
        
        fs.writeFileSync(path.join(appDir, 'README.txt'), readme);
        
        console.log(`\n✅ 便携版创建完成！`);
        console.log(`📁 位置: ${appDir}`);
        console.log(`🚀 双击 "启动.bat" 即可运行应用`);
        
        return appDir;
        
    } catch (error) {
        console.error('❌ 打包失败:', error.message);
        throw error;
    }
}

// 递归复制目录
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    items.forEach(item => {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// 运行打包
if (require.main === module) {
    buildApp().catch(console.error);
}

module.exports = { buildApp }; 