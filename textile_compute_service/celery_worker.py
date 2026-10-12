"""
Elite Edition Celery Production Worker
Strict memory isolation for AWS EC2 t3.medium.
"""

import os
import gc
from celery import Celery
from celery.signals import task_postrun

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1")

celery_app = Celery(
    "textile_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    # HARD RESOURCE RESTRICTIONS FOR t3.medium:
    worker_concurrency=1,               # Exactly 1 active process to prevent memory contention
    worker_prefetch_multiplier=1,        # Process one job at a time
    worker_max_tasks_per_child=5,        # Recycle OS process every 5 jobs (eliminates C-allocator fragmentation)
    worker_max_memory_per_child=1500000, # 1.5 GB hard auto-restart threshold
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)


@task_postrun.connect
def cleanup_after_task(sender=None, **kwargs):
    """Force garbage collection after every heavy processing task."""
    gc.collect()


@celery_app.task(name="tasks.execute_full_preflight", bind=True)
def execute_full_preflight_task(self, payload: dict):
    """
    Executes heavy CMYK and repeat seam processing asynchronously.
    """
    import asyncio
    from main import full_cmyk_and_repeat_analysis, FullAnalysisRequest

    request_obj = FullAnalysisRequest(**payload)
    loop = asyncio.get_event_loop()
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    result = loop.run_until_complete(full_cmyk_and_repeat_analysis(request_obj))
    return result.model_dump()
