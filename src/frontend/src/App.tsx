import { Layout } from "@/components/Layout";
import { initTheme } from "@/lib/theme";
import AnalyzeLabsPage from "@/pages/AnalyzeLabsPage";
import ConnectPage from "@/pages/ConnectPage";
import HomePage from "@/pages/HomePage";
import HowItWorksPage from "@/pages/HowItWorksPage";
import PredictPage from "@/pages/PredictPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RecordPage from "@/pages/RecordPage";
import SymptomsPage from "@/pages/SymptomsPage";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connect",
  component: ConnectPage,
});

const predictRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/predict",
  component: PredictPage,
});

const analyzeLabsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analyze-labs",
  component: AnalyzeLabsPage,
});

const recordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/record",
  component: RecordPage,
});

const symptomsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/symptoms",
  component: SymptomsPage,
});

const howItWorksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/how-it-works",
  component: HowItWorksPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  connectRoute,
  predictRoute,
  analyzeLabsRoute,
  recordRoute,
  symptomsRoute,
  howItWorksRoute,
  privacyRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return <RouterProvider router={router} />;
}
