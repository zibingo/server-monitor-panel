document.addEventListener('DOMContentLoaded', function() {
    // 获取刷新按钮
    const refreshBtn = document.getElementById('refresh-btn');
    
    // 添加点击事件处理器
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshData();
        });
    }
    
    // 设置自动刷新定时器（30秒）
    setInterval(refreshData, 1000);
    
    // 刷新数据函数
    function refreshData() {
        fetch('/refresh')
            .then(response => response.json())
            .then(data => {
                updateCards(data);
            })
            .catch(error => {
                console.error('刷新数据时出错:', error);
            });
    }
    
    // 更新卡片显示
    function updateCards(nodes) {
        nodes.forEach(node => {
            // 获取对应的卡片元素
            const cardElement = document.getElementById(`node-${node.node_id}`);
            
            if (cardElement) {
                // 如果节点离线，只更新状态
                if (node.status === 'offline' || node.status === 'error') {
                    updateStatusBadge(cardElement, node.status);
                    return;
                }
                
                // 更新CPU信息
                if (node.cpu) {
                    updateProgressBar(
                        cardElement, 
                        'CPU', 
                        node.cpu.usage_percent, 
                        `${node.cpu.physical_cores} 物理核心 / ${node.cpu.total_cores} 逻辑核心`
                    );
                }
                
                // 更新内存信息
                if (node.memory) {
                    updateProgressBar(
                        cardElement, 
                        '内存', 
                        node.memory.percent, 
                        `${node.memory.used} / ${node.memory.total}`
                    );
                }
                
                // 更新交换分区信息
                if (node.swap) {
                    updateProgressBar(
                        cardElement, 
                        '交换', 
                        node.swap.percent, 
                        `${node.swap.used} / ${node.swap.total}`
                    );
                }
                
                // 更新硬盘信息
                if (node.disk && node.disk.length > 0) {
                    updateProgressBar(
                        cardElement, 
                        '硬盘', 
                        node.disk_percent, 
                        `${node.disk[0].used} / ${node.disk[0].total}`
                    );
                }
                
                // 更新autodl-tmp目录信息
                if (node.autodl_tmp_disk) {
                    updateProgressBar(
                        cardElement,
                        'autodl-tmp',
                        node.autodl_tmp_disk.percent,
                        `${node.autodl_tmp_disk.used} / ${node.autodl_tmp_disk.total}`
                    );
                }
                
                // 更新Flask应用目录信息
                if (node.flask_app_disk) {
                    updateProgressBar(
                        cardElement,
                        'Flask应用',
                        node.flask_app_disk.percent,
                        `${node.flask_app_disk.used} / ${node.flask_app_disk.total}`
                    );
                }
                
                // 更新负载信息
                if (node.load) {
                    updateLoadValues(cardElement, node.load);
                }
                
                // 更新网络信息
                if (node.network) {
                    updateNetworkValues(cardElement, node.network);
                }
                
                // 更新或添加GPU信息（如果有）
                if (node.gpu && node.gpu.length > 0) {
                    updateGpuInfo(cardElement, node.gpu);
                }
            }
        });
    }
    
    // 更新状态标签
    function updateStatusBadge(card, status) {
        // 更新卡片CSS类
        card.className = card.className.replace(/\b(offline|error)\b/g, '');
        if (status === 'offline' || status === 'error') {
            card.classList.add(status);
        }
        
        // 更新状态标签
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = 'status-badge';
            statusBadge.classList.add(status);
            
            if (status === 'offline') {
                statusBadge.textContent = '离线';
            } else if (status === 'error') {
                statusBadge.textContent = '错误';
            } else {
                statusBadge.textContent = '在线';
                statusBadge.classList.add('online');
            }
        }
    }
    
    // 更新进度条
    function updateProgressBar(card, metricName, percent, detailText) {
        // 找到对应的指标项
        const metricHeaders = card.querySelectorAll('.metric-header');
        
        for (let i = 0; i < metricHeaders.length; i++) {
            const header = metricHeaders[i];
            const nameElement = header.querySelector('.metric-name');
            
            if (nameElement && nameElement.textContent === metricName) {
                // 找到了对应的指标项，更新它
                const valueElement = header.querySelector('.metric-value');
                if (valueElement) {
                    valueElement.textContent = `${percent}%`;
                }
                
                // 更新进度条
                const progressBar = header.parentElement.querySelector('.progress-bar');
                if (progressBar) {
                    // 设置宽度
                    progressBar.style.width = `${percent}%`;
                    progressBar.setAttribute('aria-valuenow', percent);
                    
                    // 设置颜色
                    progressBar.className = 'progress-bar';
                    if (percent < 60) {
                        progressBar.classList.add('bg-success');
                    } else if (percent < 80) {
                        progressBar.classList.add('bg-warning');
                    } else {
                        progressBar.classList.add('bg-danger');
                    }
                }
                
                // 更新详情文本
                const detailElement = header.parentElement.querySelector('.metric-details small');
                if (detailElement) {
                    detailElement.textContent = detailText;
                }
                
                break;
            }
        }
    }
    
    // 更新负载值
    function updateLoadValues(card, load) {
        const loadSection = card.querySelector('.system-load-section');
        if (!loadSection) return;
        
        const loadItems = loadSection.querySelectorAll('.load-item');
        if (loadItems.length === 3) {
            // 1分钟负载
            loadItems[0].querySelector('.load-value').textContent = load.load1 + '%';
            // 5分钟负载
            loadItems[1].querySelector('.load-value').textContent = load.load5 + '%';
            // 15分钟负载
            loadItems[2].querySelector('.load-value').textContent = load.load15 + '%';
        }
    }
    
    // 更新网络信息
    function updateNetworkValues(card, network) {
        const networkSection = card.querySelector('.network-section');
        if (!networkSection) return;
        
        // 更新网速
        const networkStats = networkSection.querySelector('.network-stats');
        if (networkStats) {
            const rows = networkStats.querySelectorAll('.network-row');
            if (rows.length === 2) {
                // 上传速度
                rows[0].querySelector('.network-value').textContent = network.upload_speed;
                // 下载速度
                rows[1].querySelector('.network-value').textContent = network.download_speed;
            }
        }
    }
    
    // 更新GPU信息
    function updateGpuInfo(card, gpus) {
        // 查找metrics-section
        const metricsSection = card.querySelector('.metrics-section');
        if (!metricsSection) return;
        
        // 查找所有与GPU相关的指标项（需要删除的旧项）
        const gpuItems = Array.from(metricsSection.querySelectorAll('.metric-item')).filter(item => {
            const nameElement = item.querySelector('.metric-name');
            return nameElement && (nameElement.textContent.includes('GPU'));
        });
        
        // 删除旧的GPU项
        gpuItems.forEach(item => item.remove());
        
        // 找到CPU指标，我们要在它后面插入GPU项
        const cpuMetricItem = metricsSection.querySelector('.metric-item');
        if (!cpuMetricItem) return;
        
        // 插入点 - CPU后面
        let insertAfter = cpuMetricItem;
        
        // 为每个GPU创建指标项
        gpus.forEach((gpu, index) => {
            // 计算显存使用百分比
            const memoryUsed = parseInt(gpu.memoryUsed);
            const memoryTotal = parseInt(gpu.memoryTotal);
            const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);
            
            // 设置显存进度条颜色
            let memoryProgressClass = 'bg-success';
            if (memoryPercent >= 80) {
                memoryProgressClass = 'bg-danger';
            } else if (memoryPercent >= 60) {
                memoryProgressClass = 'bg-warning';
            }
            
            // 创建GPU信息项（合并显示）
            const gpuItem = document.createElement('div');
            gpuItem.className = 'metric-item';
            gpuItem.innerHTML = `
                <div class="metric-header">
                    <span class="metric-name">GPU ${gpu.id}</span>
                    <span class="metric-value">${gpu.load}</span>
                </div>
                <div class="progress">
                    <div class="progress-bar ${memoryProgressClass}" 
                        role="progressbar" 
                        style="width: ${memoryPercent}%" 
                        aria-valuenow="${memoryPercent}" 
                        aria-valuemin="0" 
                        aria-valuemax="100">
                    </div>
                </div>
                <div class="metric-details">
                    <small>${gpu.name}</small>
                    <small>${gpu.used_memory}/${gpu.total_memory}</small>
                    <small>${gpu.temperature}</small>
                </div>
            `;
            
            // 插入GPU项
            insertAfter.insertAdjacentElement('afterend', gpuItem);
            insertAfter = gpuItem;
        });
    }
}); 