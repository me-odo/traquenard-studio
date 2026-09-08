import { CURRENT_AUTHORING_BASELINE_ID } from './baseline.js';

export type LabStatus = 'active' | 'supporting' | 'retired';
export type DeviceProfileId = 'desktop' | 'phone';

export interface DeviceProfile {
  readonly id: DeviceProfileId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export interface LabFixture {
  readonly id: string;
  readonly label: string;
}

export interface LabConfiguration {
  readonly key: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export interface LabManifest {
  readonly id: 'authoring' | 'parallel' | 'references';
  readonly baselineId: typeof CURRENT_AUTHORING_BASELINE_ID;
  readonly issue: number;
  readonly title: string;
  readonly status: Exclude<LabStatus, 'retired'>;
  readonly route: `/lab/${string}`;
  readonly hypothesis: string;
  readonly experimentalAxes: readonly string[];
  readonly fixtures: readonly LabFixture[];
  readonly configurations: readonly LabConfiguration[];
  readonly defaultConfiguration: Readonly<Record<string, string>>;
  readonly deviceProfiles: readonly DeviceProfileId[];
}

export const deviceProfiles: Readonly<Record<DeviceProfileId, DeviceProfile>> = {
  desktop: { id: 'desktop', label: 'Desktop', width: 1280, height: 800 },
  phone: { id: 'phone', label: 'Phone', width: 390, height: 844 },
};

export const activeLabRegistry: readonly LabManifest[] = [
  {
    id: 'authoring',
    baselineId: CURRENT_AUTHORING_BASELINE_ID,
    issue: 6,
    title: 'Core authoring grammar',
    status: 'active',
    route: '/lab/authoring',
    hypothesis:
      'A first-time author can understand Data, named Workflows, and nested flow editing without learning engine architecture.',
    experimentalAxes: ['structured containment geometry'],
    fixtures: [
      { id: 'challenge', label: 'Friday Night Challenge' },
      { id: 'long-flow', label: 'Long flow retest' },
    ],
    configurations: [
      {
        key: 'containment',
        label: 'Containment',
        options: [
          { value: 'c-shape', label: 'C-shaped' },
          { value: 'framed', label: 'Framed comparison' },
        ],
      },
    ],
    defaultConfiguration: { containment: 'c-shape' },
    deviceProfiles: ['desktop', 'phone'],
  },
  {
    id: 'parallel',
    baselineId: CURRENT_AUTHORING_BASELINE_ID,
    issue: 1,
    title: 'Parallel execution grammar',
    status: 'supporting',
    route: '/lab/parallel',
    hypothesis:
      'Authors can identify concurrent branches and the all-join boundary without graph-canvas semantics.',
    experimentalAxes: ['parallel projection'],
    fixtures: [
      { id: 'two-player', label: '2-player' },
      { id: 'group-vote', label: 'Group vote' },
      { id: 'mixed', label: 'Mixed branches' },
      { id: 'stress', label: '6-branch stress' },
    ],
    configurations: [
      {
        key: 'projection',
        label: 'Projection',
        options: [
          { value: 'grouped', label: 'Grouped' },
          { value: 'lanes', label: 'Lanes' },
          { value: 'fork-join', label: 'Fork / Join' },
        ],
      },
    ],
    defaultConfiguration: { projection: 'grouped' },
    deviceProfiles: ['desktop', 'phone'],
  },
  {
    id: 'references',
    baselineId: CURRENT_AUTHORING_BASELINE_ID,
    issue: 2,
    title: 'Typed references and semantic navigation',
    status: 'supporting',
    route: '/lab/references',
    hypothesis:
      'Typed local chips plus optional semantic navigation preserve provenance without permanent cable clutter.',
    experimentalAxes: ['semantic navigation', 'trace overlay'],
    fixtures: [
      { id: 'two-decks', label: 'A · Two collections' },
      { id: 'current-player', label: 'B · Distant player' },
      { id: 'drawn-card', label: 'C · Drawn card' },
      { id: 'composite', label: 'D · Workflow' },
      { id: 'incompatible', label: 'E · Incompatible' },
      { id: 'long-flow', label: 'F · Long flow' },
    ],
    configurations: [
      {
        key: 'navigation',
        label: 'Semantic navigation',
        options: [
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ],
      },
      {
        key: 'traces',
        label: 'Trace overlay',
        options: [
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ],
      },
    ],
    defaultConfiguration: { navigation: 'on', traces: 'off' },
    deviceProfiles: ['desktop', 'phone'],
  },
] as const;

export function labManifest(id: string): LabManifest | undefined {
  return activeLabRegistry.find((manifest) => manifest.id === id);
}

export function normalizedLabState(manifest: LabManifest, search: URLSearchParams) {
  const requestedDevice = search.get('device');
  const device = manifest.deviceProfiles.includes(requestedDevice as DeviceProfileId)
    ? (requestedDevice as DeviceProfileId)
    : (manifest.deviceProfiles[0] ?? 'desktop');
  const requestedFixture = search.get('fixture');
  const fixture = manifest.fixtures.some((item) => item.id === requestedFixture)
    ? requestedFixture!
    : manifest.fixtures[0]!.id;
  const configuration = Object.fromEntries(
    manifest.configurations.map((field) => {
      const requested = search.get(field.key);
      const fallback = manifest.defaultConfiguration[field.key] ?? field.options[0]!.value;
      return [
        field.key,
        field.options.some((option) => option.value === requested) ? requested! : fallback,
      ];
    }),
  );
  return { device, fixture, configuration } as {
    readonly device: DeviceProfileId;
    readonly fixture: string;
    readonly configuration: Readonly<Record<string, string>>;
  };
}
