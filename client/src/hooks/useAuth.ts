import { useQuery } from "@tanstack/react-query";
import { isOtpAuthenticated } from "../lib/authUtils";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check for both OTP and Replit authentication
  const hasOtpAuth = isOtpAuthenticated();
  const hasReplitAuth = !!user;

  return {
    user,
    isLoading,
    isAuthenticated: hasOtpAuth || hasReplitAuth,
  };
}
