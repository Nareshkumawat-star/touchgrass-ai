import { OfflineMissionView } from "@/components/offline-mission-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation request cannot reach the
 * network. It is a real, usable screen: the cached mission plus the ability to
 * finish it offline.
 */
export default function OfflinePage() {
  return <OfflineMissionView />;
}
