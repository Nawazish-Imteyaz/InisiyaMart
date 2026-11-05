import type { Metadata } from "next";
import { AdminApp } from "./AdminApp";
import "./admin.css";
import "./admin-v2.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
