const { ipcRenderer } = require('electron');
let calculationInterval;
let config = null;
let todayEarnings = 0; // 当天已赚金额
let lastSaveDate = null; // 上次保存的日期

// 页面加载时直接加载配置并开始计算
window.onload = () => {
    loadUserSalary();
    loadTodayEarnings(); // 加载当天收入
};

// 添加日志函数
function log(message, type = 'info') {
    console.log(`[${new Date().toLocaleTimeString()}] [${type}] ${message}`);
}

// 保存当天收入
function saveTodayEarnings(amount) {
    const today = new Date().toDateString();
    const data = {
        date: today,
        amount: amount,
        timestamp: Date.now()
    };
    localStorage.setItem('todayEarnings', JSON.stringify(data));
    todayEarnings = amount;
    lastSaveDate = today;
    log(`保存当天收入: ¥${amount.toFixed(2)}`);
}

// 加载当天收入
function loadTodayEarnings() {
    try {
        const data = localStorage.getItem('todayEarnings');
        if (data) {
            const earnings = JSON.parse(data);
            const today = new Date().toDateString();
            
            // 如果是同一天的数据，加载；否则清零
            if (earnings.date === today) {
                todayEarnings = earnings.amount || 0;
                lastSaveDate = earnings.date;
                log(`加载当天收入: ¥${todayEarnings.toFixed(2)}`);
            } else {
                log('检测到新的一天，清零收入');
                todayEarnings = 0;
                lastSaveDate = null;
                // 清除旧数据
                localStorage.removeItem('todayEarnings');
            }
        } else {
            todayEarnings = 0;
            lastSaveDate = null;
        }
    } catch (error) {
        log('加载当天收入失败: ' + error.message, 'error');
        todayEarnings = 0;
        lastSaveDate = null;
    }
}

// 检查是否需要重置收入（跨天检查）
function checkDateReset() {
    const today = new Date().toDateString();
    if (lastSaveDate && lastSaveDate !== today) {
        log('检测到日期变化，重置收入');
        todayEarnings = 0;
        lastSaveDate = null;
        localStorage.removeItem('todayEarnings');
        return true;
    }
    return false;
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

// 计算当前应该赚取的金额（基于实际工作时间）
function calculateCurrentEarnings() {
    const currentTime = new Date();
    
    // 获取今天的工作开始时间
    const [startHour, startMinute] = config.workStartTime.split(':').map(Number);
    const workStartTime = new Date();
    workStartTime.setHours(startHour, startMinute, 0, 0);

    // 获取今天的工作结束时间
    const [endHour, endMinute] = config.workEndTime.split(':').map(Number);
    const workEndTime = new Date();
    workEndTime.setHours(endHour, endMinute, 0, 0);

    // 设置午休时间
    const [lunchStartHour, lunchStartMinute] = config.lunchBreakStart.split(':').map(Number);
    const lunchStartTime = new Date();
    lunchStartTime.setHours(lunchStartHour, lunchStartMinute, 0, 0);

    const [lunchEndHour, lunchEndMinute] = config.lunchBreakEnd.split(':').map(Number);
    const lunchEndTime = new Date();
    lunchEndTime.setHours(lunchEndHour, lunchEndMinute, 0, 0);

    let effectiveWorkTime = 0;

    // 如果当前时间早于工作开始时间，返回0
    if (currentTime < workStartTime) {
        return 0;
    }

    // 如果当前时间超过工作结束时间，使用工作结束时间来计算
    const endTime = currentTime > workEndTime ? workEndTime : currentTime;

    // 如果结束时间在午休之前
    if (endTime <= lunchStartTime) {
        effectiveWorkTime = (endTime - workStartTime) / 1000;
    }
    // 如果结束时间在午休期间
    else if (endTime > lunchStartTime && endTime <= lunchEndTime) {
        effectiveWorkTime = (lunchStartTime - workStartTime) / 1000;
    }
    // 如果结束时间在午休之后
    else {
        effectiveWorkTime = (endTime - workStartTime) / 1000 - 
                           (lunchEndTime - lunchStartTime) / 1000;
    }

    // 如果effectiveWorkTime小于0，返回0
    if (effectiveWorkTime < 0) {
        return 0;
    }

    // 计算每秒收入
    const workHoursPerDay = calculateWorkHours();
    const workDaysPerMonth = (52 * config.workDays.length) / 12;
    const secondsPerMonth = workDaysPerMonth * workHoursPerDay * 3600;
    const earnedAmount = (config.monthlySalary / secondsPerMonth) * effectiveWorkTime;

    return earnedAmount;
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
        
        // 检查是否跨天
        checkDateReset();
        
        // 获取当前是否在工作时间
        const isWorkTime = checkWorkTime();
        
        // 检查是否是工作日
        const currentDay = currentTime.getDay() || 7;
        const isWorkDay = config.workDays.includes(currentDay);
        
        if (!isWorkDay) {
            // 非工作日，显示当前已保存的收入
            document.getElementById('result').textContent = `¥${todayEarnings.toFixed(2)}`;
            document.getElementById('countdown').textContent = '非工作日';
            return;
        }

        if (!isWorkTime) {
            // 不在工作时间，但显示当天已赚金额
            const currentEarnings = calculateCurrentEarnings();
            if (currentEarnings > todayEarnings) {
                todayEarnings = currentEarnings;
                saveTodayEarnings(todayEarnings);
            }
            
            document.getElementById('result').textContent = `¥${todayEarnings.toFixed(2)}`;
            
            // 判断状态
            const now = new Date();
            const [startHour, startMinute] = config.workStartTime.split(':').map(Number);
            const workStart = new Date();
            workStart.setHours(startHour, startMinute, 0, 0);
            
            const [endHour, endMinute] = config.workEndTime.split(':').map(Number);
            const workEnd = new Date();
            workEnd.setHours(endHour, endMinute, 0, 0);
            
            const [lunchStartHour, lunchStartMinute] = config.lunchBreakStart.split(':').map(Number);
            const lunchStart = new Date();
            lunchStart.setHours(lunchStartHour, lunchStartMinute, 0, 0);
            
            const [lunchEndHour, lunchEndMinute] = config.lunchBreakEnd.split(':').map(Number);
            const lunchEnd = new Date();
            lunchEnd.setHours(lunchEndHour, lunchEndMinute, 0, 0);
            
            if (now < workStart) {
                document.getElementById('countdown').textContent = '工作还未开始';
            } else if (now >= lunchStart && now <= lunchEnd) {
                document.getElementById('countdown').textContent = '午休时间';
            } else if (now > workEnd) {
                document.getElementById('countdown').textContent = '今日工作已结束';
            } else {
                document.getElementById('countdown').textContent = '未在工作时间';
            }
            return;
        }

        // 在工作时间，正常计算
        const currentEarnings = calculateCurrentEarnings();
        
        // 更新todayEarnings为当前计算值（实时更新）
        todayEarnings = currentEarnings;
        
        // 每分钟保存一次
        if (Math.floor(Date.now() / 60000) % 1 === 0) {
            saveTodayEarnings(todayEarnings);
        }

        // 获取今天的工作开始时间用于显示计时
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

        // 计算显示用的工作时间
        let displayWorkTime = 0;
        if (currentTime <= lunchStartTime) {
            displayWorkTime = (currentTime - workStartTime) / 1000;
        } else {
            displayWorkTime = (currentTime - workStartTime) / 1000 - 
                             (lunchEndTime - lunchStartTime) / 1000;
        }

        if (displayWorkTime < 0) displayWorkTime = 0;

        // 格式化工作时间显示
        const hours = Math.floor(displayWorkTime / 3600);
        const minutes = Math.floor((displayWorkTime % 3600) / 60);
        const seconds = Math.floor(displayWorkTime % 60);
        const timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('countdown').textContent = timeDisplay;

        // 更新显示
        document.getElementById('result').textContent = `¥${todayEarnings.toFixed(2)}`;
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