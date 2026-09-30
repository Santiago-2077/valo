from app.scheduler import create_scheduler


def test_daily_job_runs_after_midnight_in_user_timezone() -> None:
    scheduler = create_scheduler()
    job = scheduler.get_job("daily")
    assert job is not None
    fields = {f.name: str(f) for f in job.trigger.fields}
    assert (fields["hour"], fields["minute"]) == ("0", "10")
    assert str(job.trigger.timezone) == "America/Mexico_City"
