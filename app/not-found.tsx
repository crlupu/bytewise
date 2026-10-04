import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty" style={{ paddingTop: "6rem" }}>
      <p className="empty__title">This page doesn't exist</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/" className="btn btn--primary">
          Back to lessons
        </Link>
      </p>
    </div>
  );
}
