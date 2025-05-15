#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import Flask, jsonify
import psutil
import platform
import time
import datetime
import socket
import os

try:
    import GPUtil
    has_gpu = True
except ImportError:
    has_gpu = False

app = Flask(__name__)

# 存储网络速度计算的变量
last_net_io = None
last_check_time = None

def get_size(bytes, suffix="B"):
    """
    转换字节大小为人类可读的格式
    """
    factor = 1024
    for unit in ["", "K", "M", "G", "T", "P"]:
        if bytes < factor:
            return f"{bytes:.2f}{unit}{suffix}"
        bytes /= factor

def get_system_info():
    """获取本机系统信息"""
    global last_net_io, last_check_time
    
    info = {}
    
    # 系统信息
    info['hostname'] = socket.gethostname()
    info['platform'] = platform.system()
    info['platform_release'] = platform.release()
    info['platform_version'] = platform.version()
    info['architecture'] = platform.machine()
    
    # 获取更详细的CPU型号信息
    try:
        if platform.system() == "Linux":
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        info['processor'] = line.split(':')[1].strip()
                        break
        elif platform.system() == "Windows":
            import subprocess
            output = subprocess.check_output("wmic cpu get name", shell=True).decode().strip().split('\n')[1]
            info['processor'] = output.strip()
        else:
            info['processor'] = platform.processor()
    except:
        info['processor'] = platform.processor()  # 作为备选方案
    
    # CPU信息
    physical_cores = psutil.cpu_count(logical=False)
    total_cores = psutil.cpu_count(logical=True)
    cpu_freq = psutil.cpu_freq()
    cpu_percent = psutil.cpu_percent(interval=1)
    
    info['cpu'] = {
        'physical_cores': physical_cores,
        'total_cores': total_cores,
        'max_frequency': f"{cpu_freq.max:.2f}Mhz" if cpu_freq else "N/A",
        'current_frequency': f"{cpu_freq.current:.2f}Mhz" if cpu_freq else "N/A",
        'usage_percent': cpu_percent
    }
    
    # 内存信息
    svmem = psutil.virtual_memory()
    info['memory'] = {
        'total': get_size(svmem.total),
        'available': get_size(svmem.available),
        'used': get_size(svmem.used),
        'percent': svmem.percent
    }
    
    # 交换内存信息
    swap = psutil.swap_memory()
    info['swap'] = {
        'total': get_size(swap.total),
        'free': get_size(swap.free),
        'used': get_size(swap.used),
        'percent': swap.percent
    }
    
    # 硬盘信息
    partitions = psutil.disk_partitions()
    disk_info = []
    
    for partition in partitions:
        try:
            partition_usage = psutil.disk_usage(partition.mountpoint)
            disk_info.append({
                'device': partition.device,
                'mountpoint': partition.mountpoint,
                'total': get_size(partition_usage.total),
                'used': get_size(partition_usage.used),
                'free': get_size(partition_usage.free),
                'percent': partition_usage.percent
            })
        except Exception:
            continue
    
    info['disk'] = disk_info
    info['disk_percent'] = disk_info[0]['percent'] if disk_info else 0
    
    # 添加特定目录的硬盘使用情况
    try:
        # 检查并监控 docker 系统盘目录
        if os.path.exists(docker_system_disk_path):
            tmp_usage = psutil.disk_usage(docker_system_disk_path)
            info['docker_system_disk'] = {
                'mountpoint': docker_system_disk_path,
                'total': get_size(tmp_usage.total),
                'used': get_size(tmp_usage.used),
                'free': get_size(tmp_usage.free),
                'percent': tmp_usage.percent
            }
        
        # 检查并监控 docker 数据盘目录
        if os.path.exists(docker_data_disk_path):
            flask_usage = psutil.disk_usage(docker_data_disk_path)
            info['docker_data_disk'] = {
                'mountpoint': docker_data_disk_path,
                'total': get_size(flask_usage.total),
                'used': get_size(flask_usage.used),
                'free': get_size(flask_usage.free),
                'percent': flask_usage.percent
            }
    except Exception as e:
        print(f"获取特定目录硬盘使用情况失败: {str(e)}")
    
    # 网络信息
    net_io = psutil.net_io_counters()
    
    # 初始化网络统计
    if last_net_io is None:
        last_net_io = net_io
        last_check_time = time.time()
    
    # 计算网速
    current_time = time.time()
    time_passed = current_time - last_check_time
    
    upload_speed = (net_io.bytes_sent - last_net_io.bytes_sent) / time_passed
    download_speed = (net_io.bytes_recv - last_net_io.bytes_recv) / time_passed
    
    # 更新状态变量
    last_net_io = net_io
    last_check_time = current_time
    
    info['network'] = {
        'upload_speed': get_size(upload_speed) + "/s",
        'download_speed': get_size(download_speed) + "/s"
    }
    
    # 负载信息
    try:
        load1, load5, load15 = os.getloadavg()
        info['load'] = {
            'load1': round(load1, 2),
            'load5': round(load5, 2),
            'load15': round(load15, 2)
        }
    except:
        info['load'] = {'load1': 0, 'load5': 0, 'load15': 0}
    
    # 开机时间
    boot_time_timestamp = psutil.boot_time()
    bt = datetime.datetime.fromtimestamp(boot_time_timestamp)
    info['boot_time'] = bt.strftime("%Y-%m-%d %H:%M:%S")
    
    # 计算运行天数
    uptime_seconds = time.time() - boot_time_timestamp
    uptime_days = int(uptime_seconds / (60 * 60 * 24))
    info['uptime_days'] = uptime_days
    
    # 温度信息 (如果可用)
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        if temps:
            cpu_temp = None
            # 尝试寻找CPU温度
            for name, entries in temps.items():
                if name.lower() in ['coretemp', 'cpu_thermal', 'k10temp']:
                    if entries:
                        cpu_temp = entries[0].current
                        break
            
            info['cpu_temp'] = cpu_temp
    
    # GPU信息 (如果可用)
    if has_gpu:
        try:
            gpus = GPUtil.getGPUs()
            gpu_info = []
            
            for gpu in gpus:
                gpu_info.append({
                    'id': gpu.id,
                    'name': gpu.name,
                    'load': f"{gpu.load*100:.1f}%",
                    'free_memory': f"{gpu.memoryFree}MB",
                    'used_memory': f"{gpu.memoryUsed}MB",
                    'total_memory': f"{gpu.memoryTotal}MB",
                    'memoryUsed': gpu.memoryUsed,
                    'memoryTotal': gpu.memoryTotal,
                    'temperature': f"{gpu.temperature}°C",
                    'uuid': gpu.uuid
                })
            
            info['gpu'] = gpu_info
        except:
            info['gpu'] = []
    else:
        info['gpu'] = []
    
    return info

@app.route('/api/system-info')
def system_info_api():
    """API接口提供系统信息"""
    info = get_system_info()
    return jsonify(info)

if __name__ == '__main__':
    docker_system_disk_path = '/home/gjh303/autodl-docker-root'
    docker_data_disk_path = '/hard/autodl-docker-data'
    app.run(host='0.0.0.0', port=60000)