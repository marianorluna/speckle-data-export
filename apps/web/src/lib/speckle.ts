/**
 * Adapter around @speckle/viewer (v2.x extensions API).
 * Selection uses Revit UniqueId stored as Speckle ``applicationId``.
 */

import {
  CameraController,
  DefaultViewerParams,
  MeasurementsExtension,
  SectionOutlines,
  SectionTool,
  SelectionExtension,
  SpeckleLoader,
  UrlHelper,
  Viewer,
  ViewerEvent,
  type SelectionEvent,
  type TreeNode,
} from "@speckle/viewer";

let viewerInstance: Viewer | null = null;
let cameraController: CameraController | null = null;
let selectionExtension: SelectionExtension | null = null;
let measurementsExtension: MeasurementsExtension | null = null;
let sectionTool: SectionTool | null = null;
/** Speckle defaults to SmoothOrbitControls ("free orbit"). */
let freeOrbitActive = true;

export type ViewerInitOptions = {
  container: HTMLElement;
  serverUrl: string;
  streamId: string;
  /** Speckle commit id (from KPIs ``last_commit_id``). */
  commitId?: string | null;
  authToken?: string;
};

export type ViewerToolMode = "none" | "measure" | "section";

export type CanonicalCameraView = "top" | "front" | "left" | "back" | "right";

export type CameraUiState = {
  orthographic: boolean;
  /** Orbit (free orbit) vs fly controls. */
  freeOrbit: boolean;
};

function isOrthographicCamera(camera: object): boolean {
  return (
    "isOrthographicCamera" in camera &&
    (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true
  );
}

function buildResourceUrl(
  serverUrl: string,
  streamId: string,
  commitId?: string | null,
): string {
  const base = serverUrl.replace(/\/$/, "");
  if (commitId) {
    return `${base}/streams/${streamId}/commits/${commitId}`;
  }
  return `${base}/streams/${streamId}`;
}

function nodeApplicationId(node: TreeNode): string | null {
  const raw = node.model.raw as Record<string, unknown> | undefined;
  if (!raw) {
    return null;
  }
  const direct = raw.applicationId;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const props = raw.properties;
  if (props && typeof props === "object") {
    const unique =
      (props as Record<string, unknown>).UniqueId ??
      (props as Record<string, unknown>).uniqueId;
    if (typeof unique === "string" && unique.trim()) {
      return unique.trim();
    }
  }
  return null;
}

function findNodeIdsByApplicationIds(applicationIds: string[]): string[] {
  if (!viewerInstance || applicationIds.length === 0) {
    return [];
  }
  const wanted = new Set(applicationIds);
  const nodes = viewerInstance.getWorldTree().findAll((node) => {
    const appId = nodeApplicationId(node);
    return appId !== null && wanted.has(appId);
  });
  return [...new Set(nodes.map((node) => node.model.id))];
}

export async function initViewer(options: ViewerInitOptions): Promise<Viewer> {
  const { container, serverUrl, streamId, commitId, authToken = "" } = options;

  if (!streamId) {
    throw new Error("Speckle stream_id is empty — configure SPECKLE_STREAM_ID");
  }

  if (viewerInstance) {
    disposeViewer();
  }

  freeOrbitActive = true;

  const params = { ...DefaultViewerParams, showStats: false, verbose: false };
  const viewer = new Viewer(container, params);
  await viewer.init();

  cameraController = viewer.createExtension(CameraController);
  selectionExtension = viewer.createExtension(SelectionExtension);
  sectionTool = viewer.createExtension(SectionTool);
  viewer.createExtension(SectionOutlines);
  measurementsExtension = viewer.createExtension(MeasurementsExtension);
  measurementsExtension.enabled = false;
  sectionTool.enabled = false;

  const resourceUrl = buildResourceUrl(serverUrl, streamId, commitId);
  const urls = await UrlHelper.getResourceUrls(resourceUrl, authToken || undefined);
  if (urls.length === 0) {
    disposeViewer();
    throw new Error(`No Speckle resources for ${resourceUrl}`);
  }

  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, authToken);
    await viewer.loadObject(loader, true);
  }

  viewerInstance = viewer;
  return viewer;
}

export function getViewer(): Viewer | null {
  return viewerInstance;
}

export function resizeViewer(): void {
  viewerInstance?.resize();
}

/** Fit camera to the whole loaded model. */
export function zoomExtents(): void {
  cameraController?.setCameraView(undefined, true);
}

export function setCanonicalView(view: CanonicalCameraView): void {
  cameraController?.setCameraView(view, true);
}

export function getCameraUiState(): CameraUiState {
  const orthographic = cameraController
    ? isOrthographicCamera(cameraController.renderingCamera)
    : false;
  // Speckle defaults to SmoothOrbitControls ("free orbit"); we track fly via toggle.
  return {
    orthographic,
    freeOrbit: freeOrbitActive,
  };
}

export function setOrthographic(on: boolean): void {
  if (!cameraController) {
    return;
  }
  const isOrtho = isOrthographicCamera(cameraController.renderingCamera);
  if (on && !isOrtho) {
    cameraController.setOrthoCameraOn();
  } else if (!on && isOrtho) {
    cameraController.setPerspectiveCameraOn();
  }
}

export function toggleOrthographic(): void {
  cameraController?.toggleCameras();
}

export function setFreeOrbit(on: boolean): void {
  if (!cameraController) {
    return;
  }
  if (on === freeOrbitActive) {
    return;
  }
  cameraController.toggleControls();
  freeOrbitActive = on;
}

export function toggleFreeOrbit(): void {
  if (!cameraController) {
    return;
  }
  cameraController.toggleControls();
  freeOrbitActive = !freeOrbitActive;
}

export function getToolMode(): ViewerToolMode {
  if (measurementsExtension?.enabled) {
    return "measure";
  }
  if (sectionTool?.enabled) {
    return "section";
  }
  return "none";
}

/**
 * Activate measure / section / none. Measure and section are mutually exclusive;
 * measure temporarily disables object selection.
 */
export function setToolMode(mode: ViewerToolMode): void {
  if (!viewerInstance || !measurementsExtension || !sectionTool || !selectionExtension) {
    return;
  }

  if (mode === "measure") {
    sectionTool.enabled = false;
    measurementsExtension.enabled = true;
    selectionExtension.enabled = false;
    return;
  }

  if (mode === "section") {
    measurementsExtension.enabled = false;
    measurementsExtension.clearMeasurements();
    selectionExtension.enabled = true;
    const box = viewerInstance.getRenderer().sceneBox;
    sectionTool.setBox(box);
    sectionTool.enabled = true;
    return;
  }

  measurementsExtension.enabled = false;
  measurementsExtension.clearMeasurements();
  sectionTool.enabled = false;
  selectionExtension.enabled = true;
}

/** Select objects by Revit UniqueId / Speckle ``applicationId``. */
export function selectByApplicationIds(applicationIds: string[]): void {
  if (!selectionExtension) {
    return;
  }
  const nodeIds = findNodeIdsByApplicationIds(applicationIds);
  selectionExtension.selectObjects(nodeIds, false);
}

export function clearSelection(): void {
  selectionExtension?.clearSelection();
}

export function onObjectClicked(
  handler: (applicationId: string | null) => void,
): () => void {
  if (!viewerInstance) {
    return () => undefined;
  }
  const viewer = viewerInstance;
  const listener = (event: SelectionEvent | null) => {
    const hit = event?.hits[0];
    if (!hit) {
      handler(null);
      return;
    }
    handler(nodeApplicationId(hit.node));
  };
  viewer.on(ViewerEvent.ObjectClicked, listener);
  const emitter = viewer as unknown as {
    removeListener: (name: string, listener: (event: SelectionEvent | null) => void) => void;
  };
  return () => {
    emitter.removeListener(ViewerEvent.ObjectClicked, listener);
  };
}

export function disposeViewer(): void {
  viewerInstance?.dispose();
  viewerInstance = null;
  cameraController = null;
  selectionExtension = null;
  measurementsExtension = null;
  sectionTool = null;
  freeOrbitActive = true;
}
