import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GamepadIcon, CoinsIcon, TrophyIcon, UsersIcon } from "lucide-react";

export default function Landing() {
  const handleReplitLogin = () => {
    window.location.href = "/api/login";
  };

  const handleOtpLogin = () => {
    window.location.href = "/otp-login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-surface to-dark">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="text-6xl mb-6">🎮</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              GameHub Pro
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Experience the thrill of premium gaming with our cutting-edge platform. 
              Play, win, and compete with players worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={handleOtpLogin} 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-8 py-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Login with Email/Phone
              </Button>
              <Button 
                onClick={handleReplitLogin} 
                variant="outline"
                size="lg" 
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-xl transition-all duration-200"
              >
                Continue with Replit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Why Choose GameHub Pro?
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Join thousands of players in the ultimate gaming experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardHeader className="text-center">
              <GamepadIcon className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-white">Premium Games</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-400 text-center">
                Experience our exclusive Six-Color Challenge and thrilling Aviator games
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardHeader className="text-center">
              <CoinsIcon className="w-12 h-12 text-accent mx-auto mb-4" />
              <CardTitle className="text-white">Instant Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-400 text-center">
                Win points instantly and cash out your earnings anytime
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardHeader className="text-center">
              <TrophyIcon className="w-12 h-12 text-secondary mx-auto mb-4" />
              <CardTitle className="text-white">Competitive Play</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-400 text-center">
                Climb the leaderboards and prove you're the ultimate gamer
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardHeader className="text-center">
              <UsersIcon className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-white">Live Multiplayer</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-400 text-center">
                Play against real players in real-time multiplayer games
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary to-secondary py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Ready to Start Your Gaming Journey?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join GameHub Pro today and experience the future of online gaming
          </p>
          <Button 
            onClick={handleOtpLogin} 
            size="lg" 
            variant="secondary"
            className="bg-white text-primary text-lg px-8 py-6 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Get Started Free
          </Button>
        </div>
      </div>
    </div>
  );
}
