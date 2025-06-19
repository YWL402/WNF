const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildApp } = require('./build-simple');

async function createRelease() {
    console.log('🚀 开始创建发布包...\n');
    
    try {
        // 1. 首先创建便携版
        console.log('📦 创建便携版应用...');
        const appDir = await buildApp();
        
        // 2. 使用PowerShell创建zip文件
        const zipPath = path.join(__dirname, 'dist', 'WNF-portable.zip');
        console.log('\n📦 正在创建压缩包...');
        
        // 删除已存在的zip文件
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
        
        // 使用PowerShell压缩
        const powershellCmd = `Compress-Archive -Path "${appDir}\\*" -DestinationPath "${zipPath}" -Force`;
        execSync(`powershell -Command "${powershellCmd}"`, { stdio: 'inherit' });
        
        // 3. 显示结果
        console.log('\n✅ 发布包创建完成！');
        console.log(`📁 便携版目录: ${appDir}`);
        console.log(`📦 压缩包: ${zipPath}`);
        
        // 4. 显示文件大小
        if (fs.existsSync(zipPath)) {
            const stats = fs.statSync(zipPath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`📏 压缩包大小: ${sizeInMB} MB`);
        }
        
        console.log('\n🎉 现在您可以：');
        console.log('1. 将压缩包分享给其他用户');
        console.log('2. 上传到GitHub Releases');
        console.log('3. 解压测试便携版是否正常工作');
        
        return { appDir, zipPath };
        
    } catch (error) {
        console.error('❌ 创建发布包失败:', error.message);
        throw error;
    }
}

// 运行脚本
if (require.main === module) {
    createRelease().catch(console.error);
}

module.exports = { createRelease }; 