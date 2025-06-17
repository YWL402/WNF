const { ipcRenderer } = require('electron');

// 添加详细的日志记录
function logDebug(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log('详细数据:', data);
    }
}

// 加载用户薪资配置
function loadUserSalary() {
    logDebug('开始加载薪资配置');
    
    try {
        // 从本地存储加载配置
        const configStr = localStorage.getItem('salaryConfig');
        if (configStr) {
            const data = JSON.parse(configStr);
            logDebug('成功获取薪资配置', data);
            
            if (data.monthlySalary) {
                document.getElementById('monthlySalary').value = data.monthlySalary;
                document.getElementById('workStartTime').value = data.workStartTime?.slice(0, 5) || '09:00';
                document.getElementById('workEndTime').value = data.workEndTime?.slice(0, 5) || '18:00';
                document.getElementById('lunchStartTime').value = data.lunchBreakStart?.slice(0, 5) || '12:00';
                document.getElementById('lunchEndTime').value = data.lunchBreakEnd?.slice(0, 5) || '13:00';

                // 设置工作日 - 适配新的HTML结构
                const workdays = data.workDays || [1, 2, 3, 4, 5];
                for (let i = 1; i <= 7; i++) {
                    const checkbox = document.getElementById(`workday${i}`);
                    if (checkbox) {
                        checkbox.checked = workdays.includes(i);
                        
                        // 更新视觉样式
                        const item = checkbox.closest('.workday-item');
                        if (checkbox.checked) {
                            item.classList.add('selected');
                        } else {
                            item.classList.remove('selected');
                        }
                    }
                }
                logDebug('薪资配置已加载到表单');
            }
        } else {
            logDebug('未找到保存的配置，使用默认值');
            // 设置默认值
            document.getElementById('monthlySalary').value = '';
            document.getElementById('workStartTime').value = '09:00';
            document.getElementById('workEndTime').value = '18:00';
            document.getElementById('lunchStartTime').value = '12:00';
            document.getElementById('lunchEndTime').value = '13:00';
            
            // 默认工作日（周一到周五）
            for (let i = 1; i <= 7; i++) {
                const checkbox = document.getElementById(`workday${i}`);
                if (checkbox) {
                    checkbox.checked = [1, 2, 3, 4, 5].includes(i);
                    
                    // 更新视觉样式
                    const item = checkbox.closest('.workday-item');
                    if (checkbox.checked) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                }
            }
        }
    } catch (error) {
        logDebug('加载配置时发生错误', error);
        alert('加载配置失败: ' + error.message);
    }
}

// 保存薪资配置到本地存储
function saveToLocalStorage(configData) {
    try {
        localStorage.setItem('salaryConfig', JSON.stringify(configData));
        logDebug('配置已保存到本地存储', configData);
        return true;
    } catch (error) {
        logDebug('保存到本地存储失败', error);
        return false;
    }
}

// 更新薪资配置
function updateSalary() {
    try {
        logDebug('开始更新薪资配置');
        const monthlySalary = parseFloat(document.getElementById('monthlySalary').value);
        const workStartTime = document.getElementById('workStartTime').value;
        const workEndTime = document.getElementById('workEndTime').value;
        const lunchStartTime = document.getElementById('lunchStartTime').value;
        const lunchEndTime = document.getElementById('lunchEndTime').value;
        
        // 获取选中的工作日 - 适配新的HTML结构
        const workdays = [];
        for (let i = 1; i <= 7; i++) {
            const checkbox = document.getElementById(`workday${i}`);
            if (checkbox && checkbox.checked) {
                workdays.push(i);
            }
        }

        // 输入验证
        if (isNaN(monthlySalary) || monthlySalary <= 0) {
            logDebug('无效的月薪金额');
            alert('请输入有效的月薪金额');
            return;
        }

        if (!workStartTime || !workEndTime || !lunchStartTime || !lunchEndTime) {
            logDebug('时间字段未填写完整');
            alert('请设置所有时间字段');
            return;
        }

        if (workdays.length === 0) {
            logDebug('未选择工作日');
            alert('请至少选择一个工作日');
            return;
        }

        // 构建配置数据
        const configData = {
            monthlySalary,
            workStartTime: workStartTime + ':00',
            workEndTime: workEndTime + ':00',
            hasLunchBreak: true,
            lunchBreakStart: lunchStartTime + ':00',
            lunchBreakEnd: lunchEndTime + ':00',
            workDays: workdays,
            lastUpdated: new Date().toISOString()
        };

        logDebug('准备保存配置数据', configData);

        // 保存到本地存储
        const saveSuccess = saveToLocalStorage(configData);
        
        if (saveSuccess) {
            logDebug('配置保存成功');
            // 通知主进程配置已更新
            ipcRenderer.send('settings-updated');
            
            // 显示成功消息（已在HTML中处理）
            setTimeout(() => {
                window.close();
            }, 1500);
        } else {
            logDebug('配置保存失败');
            alert('配置保存失败，请重试');
        }
    } catch (error) {
        logDebug('更新配置时发生错误', error);
        alert(`保存配置失败: ${error.message}`);
    }
}

// 页面加载时获取配置
window.onload = loadUserSalary; 