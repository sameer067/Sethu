import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    phone?: string | null;
    name?: string | null;
  }

  interface Session {
    user: {
      id: string;
      phone?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    phone?: string;
  }
}
