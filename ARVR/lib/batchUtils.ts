export interface LevelConfigItem {
  days: number;
  code: string;
  name: string;
}

export const LEVEL_CONFIG: Record<string, LevelConfigItem> = {
  'Level 0': { days: 10, code: 'L0', name: 'Level 0 - Orientation & Spatial Computing Fundamentals' },
  'Level 1': { days: 15, code: 'L1', name: 'Level 1 - AR/VR Development & Unity XR Toolkit' },
  'Level 2': { days: 20, code: 'L2', name: 'Level 2 - Advanced Immersive Engineering & Passthrough' },
  'Level 3': { days: 25, code: 'L3', name: 'Level 3 - Enterprise Multiplayer XR Architecture' },
};

export interface TaskItem {
  id?: string;
  title: string;
  description: string;
}

export interface ResourceItem {
  id?: string;
  title: string;
  type: 'pdf' | 'link' | 'video' | 'doc' | 'other';
  url: string;
  filename?: string;
  fileSize?: number;
}

export interface DefaultCurriculumItem {
  dayNumber: number;
  taskTitle: string;
  taskDescription: string;
  tasks?: TaskItem[];
  resources?: ResourceItem[];
}

export function normalizeDayTasks(day: { taskTitle?: string; taskDescription?: string; tasks?: any }): TaskItem[] {
  if (Array.isArray(day.tasks) && day.tasks.length > 0) {
    return day.tasks.map((t, idx) => ({
      id: t.id || `task-${idx + 1}`,
      title: t.title || t.taskTitle || `Task ${idx + 1}`,
      description: t.description || t.taskDescription || '',
    }));
  }
  return [
    {
      id: 'task-1',
      title: day.taskTitle || 'Day Task',
      description: day.taskDescription || '',
    },
  ];
}

export function normalizeDayResources(day: { resources?: any }): ResourceItem[] {
  if (Array.isArray(day.resources)) {
    return day.resources.map((r, idx) => ({
      id: r.id || `res-${idx + 1}`,
      title: r.title || `Resource ${idx + 1}`,
      type: r.type || 'link',
      url: r.url || '',
      filename: r.filename,
      fileSize: r.fileSize,
    }));
  }
  return [];
}

export const DEFAULT_CURRICULUM_BY_LEVEL: Record<string, DefaultCurriculumItem[]> = {
  'Level 0': [
    { dayNumber: 1, taskTitle: 'AR/VR Orientation & Spatial Computing Fundamentals', taskDescription: 'Overview of AR/VR technology, headset hardware, and Unity development environment.' },
    { dayNumber: 2, taskTitle: 'Unity Interface & 3D Workspace Navigation', taskDescription: 'Navigate Scene View, Game View, Inspector, Hierarchy, and Project Assets.' },
    { dayNumber: 3, taskTitle: '3D Primitives, Positioning & Transform Operations', taskDescription: 'Create 3D shapes, adjust Position, Rotation, Scale, and parent-child objects.' },
    { dayNumber: 4, taskTitle: 'Basic Color Materials & Environment Lighting', taskDescription: 'Apply simple colors, PBR shaders, and directional sunlight.' },
    { dayNumber: 5, taskTitle: 'Introduction to Physics & Colliders', taskDescription: 'Add Rigidbodies and Box Colliders for basic physical gravity interactions.' },
    { dayNumber: 6, taskTitle: 'C# Scripting Basics: Debug Logs & GameObjects', taskDescription: 'Write first C# script to log messages and modify object position.' },
    { dayNumber: 7, taskTitle: 'VR Headset Setup & Camera Rig Basics', taskDescription: 'Configure main camera tracking and floor-standing XR Origin.' },
    { dayNumber: 8, taskTitle: 'Simple Spatial UI Canvas', taskDescription: 'Create 3D World-Space UI text panel and static buttons.' },
    { dayNumber: 9, taskTitle: 'Introductory Object Interaction & Grabbing', taskDescription: 'Configure simple ray casting and direct controller grab interactors.' },
    { dayNumber: 10, taskTitle: 'Final Examination: Level 0 Spatial Computing Capstone Assessment', taskDescription: 'Final practical examination: Assemble basic 3D VR environment, build stand-alone project, and submit for instructor evaluation and final grade.' },
  ],
  'Level 1': [
    { dayNumber: 1, taskTitle: 'Introduction to AR/VR Hardware & Unity Setup', taskDescription: 'Configure Unity Editor, XR Interaction Toolkit, and environment settings.' },
    { dayNumber: 2, taskTitle: '3D Coordinate Systems, Vectors & Transform Basics', taskDescription: 'Understand 3D vector math, parent-child hierarchies, and spatial positioning.' },
    { dayNumber: 3, taskTitle: 'Materials, Shaders & Lighting in Spatial Computing', taskDescription: 'Implement PBR materials, directional lighting, and lightmaps.' },
    { dayNumber: 4, taskTitle: 'Unity Physics Engine, Rigidbodies & Colliders', taskDescription: 'Setup physical collisions, triggers, and gravity forces in 3D.' },
    { dayNumber: 5, taskTitle: 'Introduction to C# Scripting for Interactive VR', taskDescription: 'Write C# scripts for object manipulation, events, and user triggers.' },
    { dayNumber: 6, taskTitle: 'Event Systems & User Input Handling', taskDescription: 'Handle controller buttons, analog sticks, and spatial interaction events.' },
    { dayNumber: 7, taskTitle: 'VR Headset Camera Rig & Tracking Systems', taskDescription: 'Configure XR Origin, main camera tracking, and floor offset.' },
    { dayNumber: 8, taskTitle: 'Spatial Audio & Sound Propagation Setup', taskDescription: 'Implement 3D spatialized audio sources and ambient soundscapes.' },
    { dayNumber: 9, taskTitle: 'UI Design Principles for Spatial Interfaces (World-Space Canvas)', taskDescription: 'Create interactive 3D UI panels, buttons, and head-locked overlays.' },
    { dayNumber: 10, taskTitle: 'Raycasting & Object Selection in Virtual Space', taskDescription: 'Implement XR Ray Interactors for distant object selection and UI pointing.' },
    { dayNumber: 11, taskTitle: 'Introduction to WebXR & Browser VR APIs', taskDescription: 'Deploy basic 3D scenes accessible via WebXR compliant browsers.' },
    { dayNumber: 12, taskTitle: 'Basic Hand Tracking & Gesture Recognition', taskDescription: 'Enable direct hand tracking interactors and pinch gesture detection.' },
    { dayNumber: 13, taskTitle: 'Scene Optimization & Target FPS Tuning', taskDescription: 'Optimize draw calls, static batching, and maintain target 90 FPS.' },
    { dayNumber: 14, taskTitle: 'Capstone Project Assembly & Build Settings', taskDescription: 'Assemble multi-scene VR application and configure Android/Standalone builds.' },
    { dayNumber: 15, taskTitle: 'Final Examination: Level 1 AR/VR Capstone & Comprehensive Assessment', taskDescription: 'Final practical examination: Submit completed Level 1 VR application build and project execution for instructor evaluation and final certificate grade.' },
  ],
  'Level 2': [
    { dayNumber: 1, taskTitle: 'Introduction to AR/VR Hardware & Unity Setup', taskDescription: 'Configure Unity Editor, XR Interaction Toolkit, and environment settings.' },
    { dayNumber: 2, taskTitle: '3D Coordinate Systems, Vectors & Transform Basics', taskDescription: 'Understand 3D vector math, parent-child hierarchies, and spatial positioning.' },
    { dayNumber: 3, taskTitle: 'Materials, Shaders & Lighting in Spatial Computing', taskDescription: 'Implement PBR materials, directional lighting, and lightmaps.' },
    { dayNumber: 4, taskTitle: 'Unity Physics Engine, Rigidbodies & Colliders', taskDescription: 'Setup physical collisions, triggers, and gravity forces in 3D.' },
    { dayNumber: 5, taskTitle: 'Introduction to C# Scripting for Interactive VR', taskDescription: 'Write C# scripts for object manipulation, events, and user triggers.' },
    { dayNumber: 6, taskTitle: 'Event Systems & User Input Handling', taskDescription: 'Handle controller buttons, analog sticks, and spatial interaction events.' },
    { dayNumber: 7, taskTitle: 'VR Headset Camera Rig & Tracking Systems', taskDescription: 'Configure XR Origin, main camera tracking, and floor offset.' },
    { dayNumber: 8, taskTitle: 'Spatial Audio & Sound Propagation Setup', taskDescription: 'Implement 3D spatialized audio sources and ambient soundscapes.' },
    { dayNumber: 9, taskTitle: 'UI Design Principles for Spatial Interfaces', taskDescription: 'Create interactive 3D UI panels, buttons, and head-locked overlays.' },
    { dayNumber: 10, taskTitle: 'Raycasting & Object Selection in Virtual Space', taskDescription: 'Implement XR Ray Interactors for distant object selection and UI pointing.' },
    { dayNumber: 11, taskTitle: 'Introduction to WebXR & Browser VR APIs', taskDescription: 'Deploy basic 3D scenes accessible via WebXR compliant browsers.' },
    { dayNumber: 12, taskTitle: 'Basic Hand Tracking & Gesture Recognition', taskDescription: 'Enable direct hand tracking interactors and pinch gesture detection.' },
    { dayNumber: 13, taskTitle: 'Scene Optimization & Target FPS Tuning', taskDescription: 'Optimize draw calls, static batching, and maintain target 90 FPS.' },
    { dayNumber: 14, taskTitle: 'Capstone Project Assembly & Build Settings', taskDescription: 'Assemble multi-scene VR application and configure Android/Standalone builds.' },
    { dayNumber: 15, taskTitle: 'Level 1 Assessment & Refinement', taskDescription: 'Evaluate Level 1 baseline performance and refine interaction physics.' },
    { dayNumber: 16, taskTitle: 'OpenXR Integration & Cross-Platform Toolkit', taskDescription: 'Implement OpenXR feature sets for multi-vendor headset compatibility.' },
    { dayNumber: 17, taskTitle: 'Complex VR Locomotion Systems', taskDescription: 'Configure Teleportation Providers, Continuous Move, and Snap Turn.' },
    { dayNumber: 18, taskTitle: 'Grabbing Dynamics & Custom Direct Interactors', taskDescription: 'Build two-handed object manipulation and physics-based door/lever handles.' },
    { dayNumber: 19, taskTitle: 'AR Foundation & Real-World Plane Detection', taskDescription: 'Configure AR Session, Plane Manager, and Raycast Manager for AR placement.' },
    { dayNumber: 20, taskTitle: 'Final Examination: Level 2 Comprehensive VR Developer Assessment', taskDescription: 'Final practical examination: Deploy complete Level 2 interactive VR experience with AR components and submit for instructor evaluation and final grade.' },
  ],
  'Level 3': [
    { dayNumber: 1, taskTitle: 'Introduction to AR/VR Hardware & Unity Setup', taskDescription: 'Configure Unity Editor, XR Interaction Toolkit, and environment settings.' },
    { dayNumber: 2, taskTitle: '3D Coordinate Systems, Vectors & Transform Basics', taskDescription: 'Understand 3D vector math, parent-child hierarchies, and spatial positioning.' },
    { dayNumber: 3, taskTitle: 'Materials, Shaders & Lighting in Spatial Computing', taskDescription: 'Implement PBR materials, directional lighting, and lightmaps.' },
    { dayNumber: 4, taskTitle: 'Unity Physics Engine, Rigidbodies & Colliders', taskDescription: 'Setup physical collisions, triggers, and gravity forces in 3D.' },
    { dayNumber: 5, taskTitle: 'Introduction to C# Scripting for Interactive VR', taskDescription: 'Write C# scripts for object manipulation, events, and user triggers.' },
    { dayNumber: 6, taskTitle: 'Event Systems & User Input Handling', taskDescription: 'Handle controller buttons, analog sticks, and spatial interaction events.' },
    { dayNumber: 7, taskTitle: 'VR Headset Camera Rig & Tracking Systems', taskDescription: 'Configure XR Origin, main camera tracking, and floor offset.' },
    { dayNumber: 8, taskTitle: 'Spatial Audio & Sound Propagation Setup', taskDescription: 'Implement 3D spatialized audio sources and ambient soundscapes.' },
    { dayNumber: 9, taskTitle: 'UI Design Principles for Spatial Interfaces', taskDescription: 'Create interactive 3D UI panels, buttons, and head-locked overlays.' },
    { dayNumber: 10, taskTitle: 'Raycasting & Object Selection in Virtual Space', taskDescription: 'Implement XR Ray Interactors for distant object selection and UI pointing.' },
    { dayNumber: 11, taskTitle: 'Introduction to WebXR & Browser VR APIs', taskDescription: 'Deploy basic 3D scenes accessible via WebXR compliant browsers.' },
    { dayNumber: 12, taskTitle: 'Basic Hand Tracking & Gesture Recognition', taskDescription: 'Enable direct hand tracking interactors and pinch gesture detection.' },
    { dayNumber: 13, taskTitle: 'Scene Optimization & Target FPS Tuning', taskDescription: 'Optimize draw calls, static batching, and maintain target 90 FPS.' },
    { dayNumber: 14, taskTitle: 'Capstone Project Assembly & Build Settings', taskDescription: 'Assemble multi-scene VR application and configure Android/Standalone builds.' },
    { dayNumber: 15, taskTitle: 'Level 1 Assessment & Refinement', taskDescription: 'Evaluate Level 1 baseline performance and refine interaction physics.' },
    { dayNumber: 16, taskTitle: 'OpenXR Integration & Cross-Platform Toolkit', taskDescription: 'Implement OpenXR feature sets for multi-vendor headset compatibility.' },
    { dayNumber: 17, taskTitle: 'Complex VR Locomotion Systems', taskDescription: 'Configure Teleportation Providers, Continuous Move, and Snap Turn.' },
    { dayNumber: 18, taskTitle: 'Grabbing Dynamics & Custom Direct Interactors', taskDescription: 'Build two-handed object manipulation and physics-based door/lever handles.' },
    { dayNumber: 19, taskTitle: 'AR Foundation & Real-World Plane Detection', taskDescription: 'Configure AR Session, Plane Manager, and Raycast Manager for AR placement.' },
    { dayNumber: 20, taskTitle: 'Level 2 Comprehensive VR Developer Evaluation', taskDescription: 'Deploy complete Level 2 interactive VR experience with AR components.' },
    { dayNumber: 21, taskTitle: 'Multiplayer VR Networking & Synchronization', taskDescription: 'Implement Netcode for GameObjects, networked transforms, and multiplayer lobby.' },
    { dayNumber: 22, taskTitle: 'Spatial Anchors & Cloud Anchors for Persistent AR', taskDescription: 'Implement ARCore/ARKit cloud anchors to persist 3D models across sessions.' },
    { dayNumber: 23, taskTitle: 'Enterprise VR Simulator Architecture', taskDescription: 'Structure industrial training simulator with state machines and guided feedback.' },
    { dayNumber: 24, taskTitle: 'Comprehensive Project Integration & Testing', taskDescription: 'Integrate multiplayer, spatial UI, physics, and conduct full regression test.' },
    { dayNumber: 25, taskTitle: 'Final Examination: Level 3 Enterprise Multiplayer XR Capstone Assessment', taskDescription: 'Final practical examination: Present and submit enterprise multiplayer AR/VR spatial computing application for evaluation panel grading and final certificate grade.' },
  ],
};

/**
 * Generates Batch Name according to system formula:
 * ARVR-[LevelCode]-[BatchNo]-[DDMMMYY]
 * Example output: ARVR-L1-001-18AUG26
 */
export function generateBatchName(
  levelOrObj: string | { level: string; batchNo: string | number; startDate: string | Date },
  batchNoParam?: string | number,
  startDateParam?: string | Date
): string {
  let level: string;
  let batchNo: string | number;
  let startDate: string | Date;

  if (typeof levelOrObj === 'object' && levelOrObj !== null) {
    level = levelOrObj.level;
    batchNo = levelOrObj.batchNo;
    startDate = levelOrObj.startDate;
  } else {
    level = levelOrObj;
    batchNo = batchNoParam || '001';
    startDate = startDateParam || new Date();
  }

  const defaultCode = LEVEL_CONFIG[level]?.code;
  const levelCode = defaultCode || level.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'L1';
  const cleanBatchNo = String(batchNo || '001').padStart(3, '0');

  const d = new Date(startDate);
  if (isNaN(d.getTime())) {
    return `ARVR-${levelCode}-${cleanBatchNo}`;
  }

  const dayStr = String(d.getDate()).padStart(2, '0');
  const monthStr = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yearStr = String(d.getFullYear()).slice(-2);

  return `ARVR-${levelCode}-${cleanBatchNo}-${dayStr}${monthStr}${yearStr}`;
}

export interface TrainingCalendarDay {
  dayNumber: number;
  date: Date;
  dateStr: string;
  dateDisplay: string;
  taskTitle: string;
  taskDescription: string;
  tasks?: TaskItem[];
  resources?: ResourceItem[];
  isExam: boolean;
  hasForenoon: boolean;
  hasAfternoon: boolean;
}

/**
 * Calculates the total scheduled attendance sessions for a batch training calendar.
 * Correctly accounts for days where Forenoon or Afternoon sessions are off/unscheduled.
 */
export function calculateBatchMaxSessions(
  calendar: Array<{ hasForenoon?: boolean; hasAfternoon?: boolean }> | undefined | null,
  fallbackDays: number = 0
): number {
  if (calendar && calendar.length > 0) {
    return calendar.reduce((sum, day) => {
      const fn = day.hasForenoon !== false ? 1 : 0;
      const an = day.hasAfternoon !== false ? 1 : 0;
      return sum + fn + an;
    }, 0);
  }
  return (fallbackDays > 0 ? fallbackDays : 0) * 2;
}

/**
 * Calculates student attendance percentage based on active scheduled sessions.
 * Never exceeds 100%. Returns 100% if no sessions were scheduled.
 */
export function calculateAttendancePercentage(
  attendedCount: number,
  maxScheduledSessions: number
): number {
  if (maxScheduledSessions <= 0) return 100;
  const pct = Math.round((attendedCount / maxScheduledSessions) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Generates training days calendar array based on Start Date and Level/Days.
 * The LAST DAY of every batch is designated as the Final Examination.
 */
export function generateTrainingDaysCalendar(
  startDate: string | Date,
  level: string,
  daysCount?: number
): TrainingCalendarDay[] {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return [];

  const defaultList = DEFAULT_CURRICULUM_BY_LEVEL[level] || DEFAULT_CURRICULUM_BY_LEVEL['Level 1'];
  const totalDays = daysCount || LEVEL_CONFIG[level]?.days || defaultList.length;

  const result: TrainingCalendarDay[] = [];
  const current = new Date(start);

  for (let i = 1; i <= totalDays; i++) {
    const dayDate = new Date(current);
    const dateStr = dayDate.toISOString().split('T')[0];
    const dateDisplay = formatDateDisplay(dayDate);
    const isLastDay = i === totalDays;

    const defaultItem = defaultList.find((item) => item.dayNumber === i);
    let taskTitle = defaultItem?.taskTitle || `Day ${i} Spatial Computing Module`;
    let taskDescription = defaultItem?.taskDescription || `Complete Day ${i} practical AR/VR training assignment.`;

    // Institutional Rule: In every batch, the last day is the Final Examination
    if (isLastDay) {
      taskTitle = `Final Examination: ${level} Comprehensive Practical Assessment`;
      taskDescription = `Final practical examination and capstone assessment for ${level}. Complete the required exam module, build and test your solution, and submit your final execution output for grading. Your instructor will evaluate this exam and assign your final certificate grade.`;
    }

    const tasksList = defaultItem?.tasks || [
      { id: `task-${i}-1`, title: taskTitle, description: taskDescription },
    ];
    const resourcesList = defaultItem?.resources || [];

    result.push({
      dayNumber: i,
      date: dayDate,
      dateStr,
      dateDisplay,
      taskTitle,
      taskDescription,
      tasks: tasksList,
      resources: resourcesList,
      isExam: isLastDay,
      hasForenoon: true,
      hasAfternoon: true,
    });

    // Advance 1 calendar day
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Calculates End Date (Exam Date) given Start Date and Number of Training Days.
 * Day 1 is the Start Date (offset 0). The final training day (Day N) is the Final Examination day and the Batch End Date.
 * Example: For 3 training days starting 17-Sep-2026:
 * Day 1 = 17-Sep, Day 2 = 18-Sep, Day 3 = 19-Sep (Exam Day & End Date).
 */
export function calculateEndDate(startDate: string | Date, trainingDays: number): string {
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '';
  const days = typeof trainingDays === 'number' && trainingDays > 0 ? trainingDays : 1;
  d.setDate(d.getDate() + (days - 1));
  return d.toISOString().split('T')[0];
}

/**
 * Calculates Exam Date (Equal to Batch End Date, as the final day of the batch is the Exam Day)
 */
export function calculateExamDate(endDate: string | Date): string {
  const d = new Date(endDate);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Format date for display: e.g. 18-Aug-2026
 */
export function formatDateDisplay(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
