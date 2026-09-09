"""
scripts/math_pdf/provenance.py
Provenance tracker for Matematika PDF Pipeline v3.
Writes atom-level line, diagram, and option origins to provenance.ndjson.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
import json
from pathlib import Path
from typing import Any


@dataclass
class QuestionProvenanceRecord:
    external_id: str
    source_pdf: str
    variant: int
    q_num: int
    pages: list[int]
    lines_count: int
    horizontal_lines_count: int
    diagram_drawings_count: int
    has_image: bool
    image_path: str | None
    option_markers_found: int
    warnings: list[str]
    errata_applied: bool


class ProvenanceWriter:
    def __init__(self, output_path: Path):
        self.output_path = output_path
        self.records: list[QuestionProvenanceRecord] = []

    def record_question(self, record: QuestionProvenanceRecord) -> None:
        self.records.append(record)

    def flush(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_path, "w", encoding="utf-8") as f:
            for rec in self.records:
                f.write(json.dumps(asdict(rec), ensure_ascii=False) + "\n")
