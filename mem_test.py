import psutil
import os
import time

def measure_memory():
    process = psutil.Process(os.getpid())
    start_mem = process.memory_info().rss / 1024 / 1024
    print(f"Start mem: {start_mem:.2f} MB")
    
    import engine_api
    start_time = time.time()
    try:
        engine_api.load_synthetic(n=5000)
    except Exception as e:
        print("Failed", e)
    
    end_mem = process.memory_info().rss / 1024 / 1024
    print(f"End mem: {end_mem:.2f} MB")
    print(f"Time: {time.time() - start_time:.2f} s")

if __name__ == '__main__':
    measure_memory()
