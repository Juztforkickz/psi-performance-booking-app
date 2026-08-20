import type { Metadata } from "next";
import { AdminQueue } from "./AdminQueue";

export const metadata: Metadata = {
  title: "Workshop booking queue",
  description: "Private PSI Performance booking request queue.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminPage() {
  return <AdminQueue />;
}
