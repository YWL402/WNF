const { ipcRenderer } = require('electron');
let calculationInterval;
let config = null;
let todayEarnings = 0; // 当天已赚金额
let lastSaveDate = null; // 上次保存的日期
let lastDisplayedAmount = null;

// 右键菜单相关
let contextMenu = document.getElementById('context-menu');
let currentStyle = localStorage.getItem('currentStyle') || '1';

// 初始化风格
document.body.className = `style-${currentStyle}`;

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
    
    // 发送收入更新到主进程
    ipcRenderer.send('earnings-update', amount);
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
                
                // 发送收入更新到主进程
                ipcRenderer.send('earnings-update', todayEarnings);
            } else {
                log('检测到新的一天，清零收入');
                todayEarnings = 0;
                lastSaveDate = null;
                // 清除旧数据
                localStorage.removeItem('todayEarnings');
                
                // 发送收入更新到主进程
                ipcRenderer.send('earnings-update', 0);
            }
        } else {
            todayEarnings = 0;
            lastSaveDate = null;
            
            // 发送收入更新到主进程
            ipcRenderer.send('earnings-update', 0);
        }
    } catch (error) {
        log('加载当天收入失败: ' + error.message, 'error');
        todayEarnings = 0;
        lastSaveDate = null;
        
        // 发送收入更新到主进程
        ipcRenderer.send('earnings-update', 0);
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
        // 发送工作状态更新
        ipcRenderer.send('work-status-update', 'Not Configured');
        return false;
    }

    const now = new Date();
    const currentDay = now.getDay() || 7; // 将周日的0转换为7
    
    // 检查是否是工作日
    if (!config.workDays.includes(currentDay)) {
        // 发送工作状态更新
        ipcRenderer.send('work-status-update', 'Weekend');
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
    const isWorkTime = now >= workStart && now <= workEnd && !(now >= lunchStart && now <= lunchEnd);
    
    // 发送工作状态更新
    let status;
    if (now < workStart) {
        status = 'Before Work';
    } else if (now > workEnd) {
        status = 'After Work';
    } else if (now >= lunchStart && now <= lunchEnd) {
        status = 'Lunch Break';
    } else {
        status = 'Working';
    }
    ipcRenderer.send('work-status-update', status);
    
    return isWorkTime;
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

// 计算距离上班或下班的时间
function calculateTimeUntil() {
    const now = new Date();
    const currentDay = now.getDay() || 7;
    
    // 如果不是工作日，返回null
    if (!config.workDays.includes(currentDay)) {
        return null;
    }

    const [workStartHour, workStartMinute] = config.workStartTime.split(':').map(Number);
    const [workEndHour, workEndMinute] = config.workEndTime.split(':').map(Number);
    const [lunchStartHour, lunchStartMinute] = config.lunchBreakStart.split(':').map(Number);
    const [lunchEndHour, lunchEndMinute] = config.lunchBreakEnd.split(':').map(Number);
    
    const workStart = new Date();
    workStart.setHours(workStartHour, workStartMinute, 0, 0);
    
    const workEnd = new Date();
    workEnd.setHours(workEndHour, workEndMinute, 0, 0);

    const lunchStart = new Date();
    lunchStart.setHours(lunchStartHour, lunchStartMinute, 0, 0);
    
    const lunchEnd = new Date();
    lunchEnd.setHours(lunchEndHour, lunchEndMinute, 0, 0);

    // 如果当前时间在午休时间内
    if (now >= lunchStart && now <= lunchEnd) {
        const timeUntilLunchEnd = lunchEnd - now;
        const hours = Math.floor(timeUntilLunchEnd / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilLunchEnd % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilLunchEnd % (1000 * 60)) / 1000);
        return { type: '午休结束', hours, minutes, seconds };
    }
    // 如果当前时间在工作时间内且在午休前（可以轮播显示）
    else if (now >= workStart && now < lunchStart) {
        // 计算距离午休的时间
        const timeUntilLunch = lunchStart - now;
        const lunchHours = Math.floor(timeUntilLunch / (1000 * 60 * 60));
        const lunchMinutes = Math.floor((timeUntilLunch % (1000 * 60 * 60)) / (1000 * 60));
        const lunchSeconds = Math.floor((timeUntilLunch % (1000 * 60)) / 1000);
        
        // 计算距离下班的时间
        const timeUntilEnd = workEnd - now;
        const endHours = Math.floor(timeUntilEnd / (1000 * 60 * 60));
        const endMinutes = Math.floor((timeUntilEnd % (1000 * 60 * 60)) / (1000 * 60));
        const endSeconds = Math.floor((timeUntilEnd % (1000 * 60)) / 1000);
        
        return { 
            type: 'beforeLunch',
            lunch: { type: '午休', hours: lunchHours, minutes: lunchMinutes, seconds: lunchSeconds },
            work: { type: '下班', hours: endHours, minutes: endMinutes, seconds: endSeconds }
        };
    }
    // 如果当前时间在午休后的工作时间内（只显示距离下班）
    else if (now > lunchEnd && now <= workEnd) {
        const timeUntilEnd = workEnd - now;
        const hours = Math.floor(timeUntilEnd / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilEnd % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilEnd % (1000 * 60)) / 1000);
        return { type: '下班', hours, minutes, seconds };
    }
    // 如果当前时间早于上班时间
    else if (now < workStart) {
        const timeUntilStart = workStart - now;
        const hours = Math.floor(timeUntilStart / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilStart % (1000 * 60)) / 1000);
        return { type: '上班', hours, minutes, seconds };
    }
    // 如果当前时间晚于下班时间
    else {
        // 计算到明天上班的时间
        const tomorrowStart = new Date(workStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const timeUntilTomorrow = tomorrowStart - now;
        const hours = Math.floor(timeUntilTomorrow / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilTomorrow % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilTomorrow % (1000 * 60)) / 1000);
        return { type: '上班', hours, minutes, seconds };
    }
}

// 轮播显示的当前索引和动画状态
let rotationIndex = 0;
let isAnimating = false;
let lastRotationTime = 0;
let currentDisplayText = ''; // 缓存当前显示的文本，避免重复更新

// 更新倒计时显示（带动画效果）
function updateCountdown() {
    const timeUntil = calculateTimeUntil();
    const countdownElement = document.getElementById('countdown');
    const indicator = document.querySelector('.rotation-indicator');
    
    if (!timeUntil) {
        setCountdownText('休息日', false);
        if (indicator) indicator.classList.remove('active');
        return;
    }

    // 如果是午休前，轮播显示距离午休和距离下班的时间
    if (timeUntil.type === 'beforeLunch') {
        const currentTime = Date.now();
        const shouldShowLunch = Math.floor(currentTime / 10000) % 2 === 0; // 改为10秒切换
        const rotationChanged = Math.floor(currentTime / 10000) !== Math.floor(lastRotationTime / 10000);
        
        // 激活轮播指示器（只在首次激活时操作DOM）
        if (indicator && !indicator.classList.contains('active')) {
            indicator.classList.add('active');
        }
        
        let newText;
        if (shouldShowLunch) {
            const { type, hours, minutes, seconds } = timeUntil.lunch;
            newText = `距离${type}还有 ${hours}小时${minutes}分${seconds}秒`;
        } else {
            const { type, hours, minutes, seconds } = timeUntil.work;
            newText = `距离${type}还有 ${hours}小时${minutes}分${seconds}秒`;
        }
        
        // 如果发生了轮播切换且文本确实变化了，使用动画
        if (rotationChanged && !isAnimating && lastRotationTime > 0 && newText !== currentDisplayText) {
            animateCountdownChange(newText);
        } else if (newText !== currentDisplayText) {
            // 文本变化但不需要轮播动画（比如秒数更新）
            setCountdownText(newText, false);
        }
        
        lastRotationTime = currentTime;
    } else {
        // 其他情况正常显示，关闭指示器
        if (indicator && indicator.classList.contains('active')) {
            indicator.classList.remove('active');
        }
        const { type, hours, minutes, seconds } = timeUntil;
        const newText = `距离${type}还有 ${hours}小时${minutes}分${seconds}秒`;
        
        // 只在文本真正变化时更新
        if (newText !== currentDisplayText) {
            setCountdownText(newText, false);
        }
    }
}

// 设置倒计时文本（简化版本）
function setCountdownText(text, addPulse = false) {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;
    
    // 缓存文本，避免重复操作
    currentDisplayText = text;
    
    // 获取文本节点（排除指示器元素）
    let textNode = Array.from(countdownElement.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) {
        // 只在文本真正不同时更新
        if (textNode.textContent !== text) {
            textNode.textContent = text;
        }
    } else {
        // 如果没有文本节点，创建一个
        const newTextNode = document.createTextNode(text);
        countdownElement.insertBefore(newTextNode, countdownElement.firstChild);
    }
}

// 动画化倒计时文本切换（简化版本）
function animateCountdownChange(newText) {
    if (isAnimating) return;
    
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;
    
    isAnimating = true;
    
    // 简单的淡出
    countdownElement.classList.add('countdown-fade-out');
    
    // 等待淡出完成后更换文本并淡入
    setTimeout(() => {
        setCountdownText(newText, false);
        countdownElement.classList.remove('countdown-fade-out');
        countdownElement.classList.add('countdown-fade-in');
        
        // 清除淡入动画
        setTimeout(() => {
            countdownElement.classList.remove('countdown-fade-in');
            isAnimating = false;
        }, 200);
    }, 200);
}

// 修改 startCalculation 函数
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
            updateIncomeDisplay(todayEarnings);
            document.getElementById('countdown').textContent = '休息日';
            return;
        }

        if (!isWorkTime) {
            // 不在工作时间，但显示当天已赚金额
            const currentEarnings = calculateCurrentEarnings();
            if (currentEarnings > todayEarnings) {
                todayEarnings = currentEarnings;
                saveTodayEarnings(todayEarnings);
            }
            
            updateIncomeDisplay(todayEarnings);
            updateCountdown();
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

        // 更新显示
        updateIncomeDisplay(todayEarnings);
        updateCountdown();
    }, 1000);
}

function stopCalculation() {
    if (calculationInterval) {
        clearInterval(calculationInterval);
        calculationInterval = null;
    }
}

// 显示右键菜单
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
});

// 点击其他地方关闭菜单
document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

// 切换风格
function changeStyle(styleNumber) {
    document.body.className = `style-${styleNumber}`;
    currentStyle = styleNumber.toString();
    localStorage.setItem('currentStyle', currentStyle);
    contextMenu.style.display = 'none';
}

// 监听配置更新事件
ipcRenderer.on('reload-data', () => {
    log('收到配置更新通知，重新加载数据');
    loadUserSalary();
});

function updateIncomeDisplay(amount) {
    const resultElement = document.getElementById('result');
    const formattedAmount = new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

    // 如果是第一次显示或者金额没有变化，直接更新文本
    if (lastDisplayedAmount === null || lastDisplayedAmount === amount) {
        resultElement.textContent = formattedAmount;
        lastDisplayedAmount = amount;
        return;
    }

    // 移除旧的数字
    while (resultElement.firstChild) {
        resultElement.removeChild(resultElement.firstChild);
    }

    // 添加货币符号
    const currencySymbol = document.createElement('span');
    currencySymbol.textContent = '¥';
    resultElement.appendChild(currencySymbol);

    // 添加每个数字
    formattedAmount.slice(1).split('').forEach((char, index) => {
        const digitSpan = document.createElement('span');
        digitSpan.className = 'digit';
        digitSpan.textContent = char;
        
        // 如果是数字（不是逗号或小数点），检查是否需要动画
        if (/\d/.test(char)) {
            const oldFormattedAmount = new Intl.NumberFormat('zh-CN', {
                style: 'currency',
                currency: 'CNY',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(lastDisplayedAmount);
            const oldChar = oldFormattedAmount.slice(1)[index];
            if (oldChar !== char) {
                digitSpan.classList.add('digit-change');
            }
        }
        
        resultElement.appendChild(digitSpan);
    });

    lastDisplayedAmount = amount;
} 