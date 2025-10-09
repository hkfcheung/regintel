import { auth, signOut } from "@/lib/auth";
import Link from "next/link";

export async function Header() {
  const session = await auth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Document stack */}
                <path
                  d="M8 3H19C19.5523 3 20 3.44772 20 4V16C20 16.5523 19.5523 17 19 17H8C7.44772 17 7 16.5523 7 16V4C7 3.44772 7.44772 3 8 3Z"
                  fill="#3B82F6"
                  stroke="#1E40AF"
                  strokeWidth="1.5"
                />
                {/* Checkmark/verification symbol */}
                <path
                  d="M10.5 10L12.5 12L16 8.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Second document behind */}
                <path
                  d="M5 7H6V19C6 19.5523 5.55228 20 5 20H5C4.44772 20 4 19.5523 4 19V8C4 7.44772 4.44772 7 5 7Z"
                  fill="#60A5FA"
                  stroke="#1E40AF"
                  strokeWidth="1.5"
                />
              </svg>
              RegIntel
            </Link>
            <nav className="ml-10 flex space-x-4">
              <Link
                href="/"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Feed
              </Link>
              {(session?.user?.role === "REVIEWER" ||
                session?.user?.role === "ADMIN") && (
                <Link
                  href="/review"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Review
                </Link>
              )}
              {session?.user?.role === "ADMIN" && (
                <>
                  <Link
                    href="/knowledge"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    SmartBuckets™
                  </Link>
                  <Link
                    href="/bulletin"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Bulletin
                  </Link>
                  <Link
                    href="/admin"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Admin
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {session.user.name || session.user.email}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {session.user.role}
                  </div>
                  <Link
                    href="/alerts"
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                  >
                    My Alerts
                  </Link>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm text-gray-700 hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
