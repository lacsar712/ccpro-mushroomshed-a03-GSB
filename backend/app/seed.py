from datetime import datetime, timedelta, timezone

from app.auth import hash_password
from app.database import SessionLocal
from app.models.climate_log import ClimateLog
from app.models.contam_check import ContamCheck
from app.models.flush_harvest import FlushHarvest
from app.models.room import Room
from app.models.shed import Shed
from app.models.user import User


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(
                        username="admin",
                        hashed_password=hash_password("123456"),
                        role="admin",
                        display_name="场长",
                    ),
                    User(
                        username="fruiter",
                        hashed_password=hash_password("123456"),
                        role="fruiter",
                        display_name="出菇员",
                    ),
                ]
            )
            db.commit()

        if db.query(Shed).count() == 0:
            s1 = Shed(
                name="松木岭一号菇房",
                location="闽北高海拔林区 A 区",
                notes="主产香菇与平菇",
            )
            s2 = Shed(
                name="溪谷恒温菇房",
                location="山谷侧翼 B 区",
                notes="杏鲍菇与秀珍菇轮作",
            )
            db.add_all([s1, s2])
            db.flush()

            r1 = Room(
                shed_id=s1.id,
                room_code="R-01",
                species="香菇",
                capacity_bags=1200,
                status="fruiting",
            )
            r2 = Room(
                shed_id=s1.id,
                room_code="R-02",
                species="平菇",
                capacity_bags=800,
                status="idle",
            )
            r3 = Room(
                shed_id=s2.id,
                room_code="V-01",
                species="杏鲍菇",
                capacity_bags=600,
                status="fruiting",
            )
            r4 = Room(
                shed_id=s2.id,
                room_code="V-02",
                species="秀珍菇",
                capacity_bags=500,
                status="sanitize",
            )
            db.add_all([r1, r2, r3, r4])
            db.flush()

            now = datetime.now(timezone.utc)
            log_r1_morning = ClimateLog(
                room_id=r1.id,
                recorded_at=now - timedelta(hours=2),
                temp_c=18.5,
                humidity_pct=88,
                co2_ppm=950.0,
                notes="晨检正常",
            )
            log_r1_night = ClimateLog(
                room_id=r1.id,
                recorded_at=now - timedelta(hours=8),
                temp_c=17.8,
                humidity_pct=90,
                co2_ppm=880.0,
                notes=None,
            )
            log_r3_recent = ClimateLog(
                room_id=r3.id,
                recorded_at=now - timedelta(hours=4),
                temp_c=16.2,
                humidity_pct=85,
                co2_ppm=720.0,
                notes="CO2 略偏高",
            )
            log_r3_earlier = ClimateLog(
                room_id=r3.id,
                recorded_at=now - timedelta(hours=12),
                temp_c=15.9,
                humidity_pct=87,
                co2_ppm=690.0,
                notes=None,
            )
            db.add_all(
                [
                    log_r1_morning,
                    log_r1_night,
                    log_r3_recent,
                    log_r3_earlier,
                    FlushHarvest(
                        room_id=r1.id,
                        harvested_at=now - timedelta(hours=6),
                        flush_no=2,
                        weight_kg=42.5,
                        grade="A",
                        operator_name="出菇员",
                    ),
                    FlushHarvest(
                        room_id=r1.id,
                        harvested_at=now - timedelta(days=1),
                        flush_no=1,
                        weight_kg=38.0,
                        grade="B",
                        operator_name="场长",
                    ),
                    FlushHarvest(
                        room_id=r3.id,
                        harvested_at=now - timedelta(days=3),
                        flush_no=1,
                        weight_kg=55.2,
                        grade="A",
                        operator_name="出菇员",
                    ),
                ]
            )
            db.flush()

            # 杂菌快检联动：V-01 快检 positive → 室态转 sanitize
            db.add_all(
                [
                    ContamCheck(
                        climate_log_id=log_r3_recent.id,
                        result="positive",
                        checked_at=now - timedelta(hours=1),
                        message="检出木霉孢子，复核确认，立即隔离消杀",
                    ),
                    ContamCheck(
                        climate_log_id=log_r1_morning.id,
                        result="suspect",
                        checked_at=now - timedelta(hours=1),
                        message="疑似链格孢，24h 后复核",
                    ),
                    ContamCheck(
                        climate_log_id=log_r1_night.id,
                        result="clear",
                        checked_at=now - timedelta(hours=2),
                        message=None,
                    ),
                ]
            )
            r3.status = "sanitize"
            db.commit()
            print("Seed data inserted.")
        else:
            print("Seed skipped (data exists).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
