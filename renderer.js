const { ipcRenderer } = require('electron');
let calculationInterval;
let config = null;

// 页面加载时直接加载配置并开始计算
window.onload = () => {
    loadUserSalary();
};

// 添加日志函数
function log(message, type = 'info') {
    console.log(`[${new Date().toLocaleTimeString()}] [${type}] ${message}`);
}

// 加载用户薪资配置
function loadUserSalary() {
    try {
        log('开始加载薪资配置');
        
        // 从本地存储加载配置
        const configStr = localStorage.getItem('salaryConfig');
        if (configStr) {
            config = JSON.parse(configStr);
            log('配置加载成功: ' + JSON.stringify(config));
            
            if (config.monthlySalary) {
                startCalculation();
            } else {
                log('配置不完整，请先设置薪资配置');
                document.getElementById('result').textContent = '请先设置薪资配置';
            }
        } else {
            log('未找到配置，请先设置薪资配置');
            document.getElementById('result').textContent = '请先设置薪资配置';
        }
    } catch (error) {
        log('加载配置失败: ' + error.message, 'error');
        document.getElementById('result').textContent = '配置加载失败';
    }
}

// 检查当前是否在工作时间
function checkWorkTime() {
    if (!config || !config.workDays) {
        return false;
    }

    const now = new Date();
    const currentDay = now.getDay() || 7; // 将周日的0转换为7
    
    // 检查是否是工作日
    if (!config.workDays.includes(currentDay)) {
        return false;
    }

    // 获取当前时间、工作时间和午休时间的Date对象
    const [workStartHour, workStartMinute] = config.workStartTime.split(':').map(Number);
    const workStart = new Date();
    workStart.setHours(workStartHour, workStartMinute, 0, 0);

    const [workEndHour, workEndMinute] = config.workEndTime.split(':').map(Number);
    const workEnd = new Date();
    workEnd.setHours(workEndHour, workEndMinute, 0, 0);

    const [lunchStartHour, lunchStartMinute] = config.lunchBreakStart.split(':').map(Number);
    const lunchStart = new Date();
    lunchStart.setHours(lunchStartHour, lunchStartMinute, 0, 0);

    const [lunchEndHour, lunchEndMinute] = config.lunchBreakEnd.split(':').map(Number);
    const lunchEnd = new Date();
    lunchEnd.setHours(lunchEndHour, lunchEndMinute, 0, 0);

    // 检查是否在工作时间内（不在午休时间）
    return now >= workStart && now <= workEnd && !(now >= lunchStart && now <= lunchEnd);
}

// 计算每天实际工作小时数
function calculateWorkHours() {
    // 转换为分钟计算
    const workStartMinutes = timeToMinutes(config.workStartTime);
    const workEndMinutes = timeToMinutes(config.workEndTime);
    const lunchStartMinutes = timeToMinutes(config.lunchBreakStart);
    const lunchEndMinutes = timeToMinutes(config.lunchBreakEnd);

    // 计算总工作时间（小时）
    const totalMinutes = (workEndMinutes - workStartMinutes) - 
                        (lunchEndMinutes - lunchStartMinutes);
    return totalMinutes / 60;
}

// 将时间字符串转换为分钟数
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function startCalculation() {
    if (!config || !config.monthlySalary) {
        log('无有效配置，跳过计算');
        return;
    }

    log('开始计算收入...');
    
    if (calculationInterval) {
        clearInterval(calculationInterval);
    }

    calculationInterval = setInterval(() => {
        const currentTime = new Date();
        
        // 获取当前是否在工作时间
        const isWorkTime = checkWorkTime();
        if (!isWorkTime) {
            document.getElementById('result').textContent = '¥0.00';
            document.getElementById('countdown').textContent = '未在工作时间';
            return;
        }

        // 获取今天的工作开始时间
        const [startHour, startMinute] = config.workStartTime.split(':').map(Number);
        const workStartTime = new Date();
        workStartTime.setHours(startHour, startMinute, 0, 0);

        // 设置午休时间
        const [lunchStartHour, lunchStartMinute] = config.lunchBreakStart.split(':').map(Number);
        const lunchStartTime = new Date();
        lunchStartTime.setHours(lunchStartHour, lunchStartMinute, 0, 0);

        const [lunchEndHour, lunchEndMinute] = config.lunchBreakEnd.split(':').map(Number);
        const lunchEndTime = new Date();
        lunchEndTime.setHours(lunchEndHour, lunchEndMinute, 0, 0);

        // 计算实际工作时间（考虑午休时间）
        let effectiveWorkTime = 0;

        // 如果当前时间早于工作开始时间，显示0
        if (currentTime < workStartTime) {
            document.getElementById('result').textContent = '¥0.00';
            document.getElementById('countdown').textContent = '工作还未开始';
            return;
        }

        // 如果当前时间在午休之前
        if (currentTime <= lunchStartTime) {
            effectiveWorkTime = (currentTime - workStartTime) / 1000;
        }
        // 如果当前时间在午休期间
        else if (currentTime > lunchStartTime && currentTime <= lunchEndTime) {
            effectiveWorkTime = (lunchStartTime - workStartTime) / 1000;
            document.getElementById('countdown').textContent = '午休时间';
            return;
        }
        // 如果当前时间在午休之后
        else {
            effectiveWorkTime = (currentTime - workStartTime) / 1000 - 
                               (lunchEndTime - lunchStartTime) / 1000;
        }

        // 如果effectiveWorkTime小于0，显示0
        if (effectiveWorkTime < 0) {
            document.getElementById('result').textContent = '¥0.00';
            document.getElementById('countdown').textContent = '计时错误';
            return;
        }

        // 格式化工作时间显示
        const hours = Math.floor(effectiveWorkTime / 3600);
        const minutes = Math.floor((effectiveWorkTime % 3600) / 60);
        const seconds = Math.floor(effectiveWorkTime % 60);
        const timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('countdown').textContent = timeDisplay;

        // 计算每秒收入（使用平均每月21.75个工作日）
        const workHoursPerDay = calculateWorkHours();
        const workDaysPerMonth = (52 * config.workDays.length) / 12; // 更准确的月工作日计算
        const secondsPerMonth = workDaysPerMonth * workHoursPerDay * 3600;
        const earnedAmount = (config.monthlySalary / secondsPerMonth) * effectiveWorkTime;

        // 更新显示
        document.getElementById('result').textContent = 
            `¥${earnedAmount.toFixed(2)}`;
    }, 1000);
}

function stopCalculation() {
    if (calculationInterval) {
        clearInterval(calculationInterval);
        calculationInterval = null;
    }
}

// 监听配置更新事件
ipcRenderer.on('reload-data', () => {
    log('收到配置更新通知，重新加载数据');
    loadUserSalary();
}); 