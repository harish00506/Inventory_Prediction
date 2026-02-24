from fastapi import APIRouter, HTTPException

from app.services.omnichannel import get_omnichannel_overview

router = APIRouter()


@router.get("/omnichannel-overview")
def omnichannel_overview(start_date: str = "", end_date: str = "", file_path: str = ""):
    try:
        return get_omnichannel_overview(
            start_date=start_date or None,
            end_date=end_date or None,
            file_path=file_path or None,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
