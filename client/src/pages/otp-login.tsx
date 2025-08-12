import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Phone, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import OtpInfoAlert from "@/components/otp-info-alert";

interface SendOtpResponse {
  success: boolean;
  message: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: any;
  isNewUser?: boolean;
}

export default function OtpLogin() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [authType, setAuthType] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [timer, setTimer] = useState(0);

  // Timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async (data: { identifier: string; type: "email" | "phone" }) => {
      const response = await apiRequest('POST', '/api/auth/send-otp', data);
      return response.json() as Promise<SendOtpResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setStep("otp");
        setTimer(120); // 2 minutes
        toast({
          title: "OTP Sent!",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { identifier: string; otp: string; type: "email" | "phone" }) => {
      const response = await apiRequest('POST', '/api/auth/verify-otp', data);
      return response.json() as Promise<VerifyOtpResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.token) {
        // Store JWT token
        localStorage.setItem('authToken', data.token);
        
        toast({
          title: data.isNewUser ? "Welcome!" : "Login Successful!",
          description: data.message,
        });

        // Redirect to home or previous page
        const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/';
        window.location.href = redirectTo;
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendOtp = () => {
    if (!identifier.trim()) {
      toast({
        title: "Error",
        description: `Please enter your ${authType === 'email' ? 'email' : 'phone number'}`,
        variant: "destructive",
      });
      return;
    }

    // Validate email format (Gmail only)
    if (authType === 'email' && !identifier.endsWith('@gmail.com')) {
      toast({
        title: "Error",
        description: "Please use a Gmail address",
        variant: "destructive",
      });
      return;
    }

    // Validate phone format
    if (authType === 'phone' && (!identifier.startsWith('+') || identifier.length < 10)) {
      toast({
        title: "Error",
        description: "Please enter a valid phone number with country code",
        variant: "destructive",
      });
      return;
    }

    sendOtpMutation.mutate({ identifier, type: authType });
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter the complete 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    verifyOtpMutation.mutate({ identifier, otp, type: authType });
  };

  const handleResendOtp = () => {
    if (timer > 0) return;
    sendOtpMutation.mutate({ identifier, type: authType });
  };

  const handleBackToIdentifier = () => {
    setStep("identifier");
    setOtp("");
    setTimer(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-black/80 border-purple-500/30 shadow-2xl shadow-purple-500/20">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-purple-400 animate-pulse" />
                <div className="absolute inset-0 bg-purple-400 rounded-full animate-ping opacity-20" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              GameHub Pro
            </CardTitle>
            <CardDescription className="text-gray-300">
              {step === "identifier" 
                ? "Enter your details to get started" 
                : "Enter the OTP sent to your " + authType}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <OtpInfoAlert />
            {step === "identifier" ? (
              <>
                <Tabs value={authType} onValueChange={(value) => setAuthType(value as "email" | "phone")}>
                  <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
                    <TabsTrigger value="email" className="flex items-center gap-2 data-[state=active]:bg-purple-600">
                      <Mail className="h-4 w-4" />
                      Gmail
                    </TabsTrigger>
                    <TabsTrigger value="phone" className="flex items-center gap-2 data-[state=active]:bg-purple-600">
                      <Phone className="h-4 w-4" />
                      Phone
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="email" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-200">Gmail Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@gmail.com"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      />
                    </div>
                    <Alert className="bg-blue-900/50 border-blue-500/50">
                      <Mail className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-blue-200">
                        We support Gmail addresses only. You'll receive a 6-digit code via email.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="phone" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-200">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+919876543210"
                        value={identifier}
                        onChange={(e) => {
                          let value = e.target.value;
                          // Auto-add +91 if user starts typing without country code
                          if (value && !value.startsWith('+') && /^\d/.test(value)) {
                            value = '+91' + value;
                          }
                          setIdentifier(value);
                        }}
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                        onFocus={(e) => {
                          // Set default +91 if field is empty
                          if (!identifier) {
                            setIdentifier('+91');
                          }
                        }}
                      />
                    </div>
                    <Alert className="bg-green-900/50 border-green-500/50">
                      <Phone className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-200">
                        +91 (India) is set by default. You'll receive a 6-digit code via SMS.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>

                <Button
                  onClick={handleSendOtp}
                  disabled={sendOtpMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendOtpMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Send OTP
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-gray-300 mb-2">
                      OTP sent to:
                    </p>
                    <p className="font-semibold text-purple-400">
                      {authType === 'email' ? identifier : identifier.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-gray-200">Enter 6-Digit OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500 text-center text-lg tracking-widest"
                      maxLength={6}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <Button
                      variant="ghost"
                      onClick={handleBackToIdentifier}
                      className="text-gray-400 hover:text-white p-0 h-auto"
                    >
                      ← Change {authType}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={handleResendOtp}
                      disabled={timer > 0 || sendOtpMutation.isPending}
                      className="text-purple-400 hover:text-purple-300 p-0 h-auto disabled:opacity-50"
                    >
                      {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                    </Button>
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    disabled={verifyOtpMutation.isPending || otp.length !== 6}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyOtpMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Login'
                    )}
                  </Button>
                </div>
              </>
            )}

            <div className="text-center text-sm text-gray-400">
              <p>
                New users get <span className="text-purple-400 font-semibold">1000 bonus points</span> upon registration!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}