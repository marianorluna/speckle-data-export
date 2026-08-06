# -*- coding: utf-8 -*-
"""
Dashboard pushbutton: start/pause the BIM spool writer.

Single entry point (no startup.py). On first ON it registers a strong
EventHandler on DocumentChanged and keeps the reference in AppDomain so the
handler survives after this button script finishes. No network, no threads.

Visual state: on.png / off.png via script.toggle_icon (no output window).
"""

import io
import json
import os
import sys
import time
import traceback

STATE_ATTR = "_bim_dashboard_push_v4"


def _report_error(msg):
    text = str(msg)
    try:
        from Autodesk.Revit.UI import TaskDialog

        TaskDialog.Show("BIM Push ERROR", text[:1500])
    except Exception:
        try:
            print(text)
        except Exception:
            pass


try:
    from System import AppDomain, EventHandler
    from Autodesk.Revit.DB.Events import DocumentChangedEventArgs

    from pyrevit import HOST_APP, script

    # pushbutton/ -> panel/ -> tab/ -> extension root (arqfi package lives there)
    _ext_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    if _ext_root not in sys.path:
        sys.path.insert(0, _ext_root)

    from arqfi import config as push_config
    from arqfi import element_extractor

    DEBOUNCE_SECONDS = push_config.DEBOUNCE_SECONDS
    MAX_SPOOL_BYTES = push_config.MAX_SPOOL_BYTES
    SPOOL_PATH = push_config.SPOOL_PATH
    extract_element_data = element_extractor.extract_element_data

    def _get_state():
        return AppDomain.CurrentDomain.GetData(STATE_ATTR)

    def _set_state(state):
        AppDomain.CurrentDomain.SetData(STATE_ATTR, state)

    def _set_icon(enabled):
        """Ribbon icon: on.png (True) / off.png (False)."""
        try:
            script.toggle_icon(bool(enabled))
        except Exception:
            pass

    def _close_output_windows():
        """Dismiss output windows so they do not pile up on each click."""
        try:
            out = script.get_output()
            try:
                out.close_others(all_open_outputs=True)
            except Exception:
                pass
            out.close()
        except Exception:
            pass

    def _append_spool(elements):
        """Silent write - no UI (avoids a window on every Revit edit)."""
        if not elements:
            return
        folder = os.path.dirname(SPOOL_PATH)
        if not os.path.isdir(folder):
            os.makedirs(folder)
        if (
            os.path.exists(SPOOL_PATH)
            and os.path.getsize(SPOOL_PATH) > MAX_SPOOL_BYTES
        ):
            os.rename(SPOOL_PATH, SPOOL_PATH + ".old")
        lines = [json.dumps(d, default=str) for d in elements]
        with io.open(SPOOL_PATH, "a", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")

    def on_document_changed(sender, args):
        state = _get_state()
        if state is None or not state.get("enabled"):
            return
        doc = HOST_APP.doc
        if doc is None:
            return
        try:
            ids = list(args.GetAddedElementIds()) + list(
                args.GetModifiedElementIds()
            )
        except Exception:
            return

        now = time.time()
        seen = set()
        batch = []
        for elem_id in ids:
            try:
                key = (
                    str(getattr(elem_id, "Value", None) or elem_id.IntegerValue)
                    if hasattr(elem_id, "Value") or hasattr(elem_id, "IntegerValue")
                    else str(elem_id)
                )
                if key in seen:
                    continue
                seen.add(key)
                last = state["last_sent"].get(key)
                if last is not None and (now - last) < DEBOUNCE_SECONDS:
                    continue
                element = doc.GetElement(elem_id)
                data = extract_element_data(element)
                if data is None:
                    continue
                state["last_sent"][key] = now
                batch.append(data)
            except Exception:
                continue

        try:
            _append_spool(batch)
        except Exception:
            pass

    state = _get_state()
    if state is None:
        # First click: register handler (strong delegate, AppDomain keeps it alive).
        delegate = EventHandler[DocumentChangedEventArgs](on_document_changed)
        HOST_APP.app.DocumentChanged += delegate
        state = {"handler": delegate, "enabled": True, "last_sent": {}}
        _set_state(state)
        _set_icon(True)
    else:
        # Toggle pause/resume; handler stays registered.
        state["enabled"] = not bool(state.get("enabled", True))
        _set_icon(state["enabled"])

    _close_output_windows()

except Exception:
    _report_error(traceback.format_exc())
