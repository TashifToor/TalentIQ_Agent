// talentiq/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // Yeh line Google se profile data ke sath URL parameters bhi allow karegi
      authorization: { params: { prompt: "consent", access_type: "offline", response_type: "code" } }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }: any) {
      // Baad mein jab tum FastAPI backend attach karoge, toh yahan se 
      // user data backend ko POST hoga database mein user create karne ke liye.
      return true;
    },
    async jwt({ token, account, req }: any) {
      if (account) {
        token.accessToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login/candidate",
  },
});

export { handler as GET, handler as POST };