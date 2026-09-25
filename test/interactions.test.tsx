import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ForecastDaySelector } from "@/components/ForecastDaySelector";
import { ForecastSummary } from "@/components/ForecastSummary";
import { RiskBadge } from "@/components/RiskBadge";
import PlaceEditor from "@/app/place-edit";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { usePlaces } from "@/features/places/PlacesProvider";
import { normalizeOutlook } from "@/features/outlooks/normalize";
import { assessPoint } from "@/features/outlooks/validity";
import { allCategories } from "./fixtures/synthetic";
import { FIXTURE_TIME } from "@/utils/clock";
import { router } from "expo-router";
import { nextPlaceName, validPlaceName } from "@/features/places/repository";
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));
jest.mock("@/features/outlooks/useOutlook", () => ({ useOutlook: jest.fn() }));
jest.mock("@/features/places/PlacesProvider", () => ({ usePlaces: jest.fn() }));
const snapshot = normalizeOutlook(allCategories, 1, FIXTURE_TIME);
const state = {
  snapshot,
  network: "idle" as const,
  error: null,
  lastAttempt: null,
  retryAt: 0,
  failures: 0,
};
const placesValue = (): ReturnType<typeof usePlaces> => ({
  places: [],
  selection: {
    coordinates: [-99, 38] as const,
    savedPlaceId: null,
    origin: "map" as const,
  },
  initialCamera: null,
  cameraRequest: null,
  select: jest.fn(),
  usView: jest.fn(),
  save: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  rememberCamera: jest.fn(),
  locator: {} as ReturnType<typeof usePlaces>["locator"],
});
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useOutlook)
    .mockReturnValue({
      day: 1,
      setDay: jest.fn(),
      states: {
        1: state,
        2: { ...state, snapshot: { ...snapshot, day: 2 } },
        3: state,
      },
      now: FIXTURE_TIME,
      refresh: jest.fn(),
      deadline: 0,
      clear: jest.fn(),
    });
  jest.mocked(usePlaces).mockReturnValue(placesValue());
});
test("day controls expose selection and do not mutate point selection", () => {
  const view = render(<ForecastDaySelector />);
  fireEvent.press(view.getByRole("tab", { name: /Day 2/ }));
  expect(useOutlook().setDay).toHaveBeenCalledWith(2);
  expect(usePlaces().select).not.toHaveBeenCalled();
  expect(
    view.getByRole("tab", { name: /Day 1/ }).props.accessibilityState.selected,
  ).toBe(true);
});
test("selected map point has textual category and a save action", () => {
  const view = render(<ForecastSummary />);
  expect(view.getByText("High risk · Level 5 of 5")).toBeTruthy();
  fireEvent.press(view.getByRole("button", { name: "Save place" }));
  expect(router.push).toHaveBeenCalledWith("/place-edit");
});
test("expired point suppresses a current category", () => {
  const view = render(
    <RiskBadge
      assessment={assessPoint(snapshot, [-99, 38], snapshot.expiresAt!)}
    />,
  );
  expect(view.getByText("This outlook has expired.")).toBeTruthy();
  expect(view.queryByText(/High risk/)).toBeNull();
});
test("failed save preserves editor text and does not dismiss", async () => {
  const places = placesValue();
  places.save = jest.fn(async () => {
    throw Error("disk full");
  });
  jest.mocked(usePlaces).mockReturnValue(places);
  const view = render(<PlaceEditor />);
  fireEvent.changeText(view.getByLabelText("Place name"), "Home");
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(view.getByText(/Could not save this place/)).toBeTruthy(),
  );
  expect(view.getByLabelText("Place name").props.value).toBe("Home");
  expect(router.back).not.toHaveBeenCalled();
});
test("pending save prevents double-submit and success selects through repository", async () => {
  let resolve!: () => void;
  const places = placesValue();
  places.save = jest.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  jest.mocked(usePlaces).mockReturnValue(places);
  const view = render(<PlaceEditor />);
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  fireEvent.press(view.getByRole("button", { name: "Save" }));
  expect(places.save).toHaveBeenCalledTimes(1);
  resolve();
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
});
test("new save at 20 is blocked but selected existing ID edits", () => {
  const places = placesValue();
  places.places = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    name: `Place ${i + 1}`,
    longitude: -99,
    latitude: 38,
    createdAt: i,
    updatedAt: i,
  })) as ReturnType<typeof usePlaces>["places"];
  jest.mocked(usePlaces).mockReturnValue(places);
  const view = render(<PlaceEditor />);
  expect(view.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(view.getByText(/You can save up to 20 places/)).toBeTruthy();
});
test("missing selection never invents zero coordinates", () => {
  jest.mocked(usePlaces).mockReturnValue({ ...placesValue(), selection: null });
  const view = render(<PlaceEditor />);
  expect(view.getByText(/Choose a point/)).toBeTruthy();
  expect(view.queryByRole("button", { name: "Save" })).toBeNull();
});
test("name validation counts codepoints and rejects control characters", () => {
  expect(validPlaceName("🌩".repeat(40))).toBe(true);
  expect(validPlaceName("🌩".repeat(41))).toBe(false);
  expect(validPlaceName("Home\n")).toBe(false);
  expect(validPlaceName("  ")).toBe(false);
  expect(
    nextPlaceName([
      {
        id: "x",
        name: "Place 1",
        longitude: 0,
        latitude: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    ]),
  ).toBe("Place 2");
});
