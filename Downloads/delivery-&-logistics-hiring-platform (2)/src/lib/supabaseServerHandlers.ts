import { withSupabase } from "@supabase/server";

/**
 * 1. Auth Mode: "none"
 * Disables all authentication. Suitable for public health checks, public status pages, etc.
 */
export const publicHealthHandler = {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Public endpoint accessed with 'none' auth mode. No credentials required.",
      authMode: ctx.authMode,
    });
  }),
};

/**
 * 2. Auth Mode: "publishable"
 * Requires a valid Supabase publishable key (anon key) in the "apikey" header.
 * Provides an RLS-scoped client (ctx.supabase) but no user identity since no JWT is passed.
 */
export const publicJobsHandler = {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    try {
      // Query the 'jobs' table using the publishable key-scoped client
      const { data, error } = await ctx.supabase
        .from("jobs")
        .select("id, title, category, companyName, city, minSalary, maxSalary")
        .limit(10);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({
        message: "Successfully retrieved jobs with 'publishable' auth mode.",
        authMode: ctx.authMode,
        jobs: data || [],
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Failed to query jobs." }, { status: 500 });
    }
  }),
};

/**
 * 3. Auth Mode: "user"
 * Requires a valid user JWT in the "Authorization: Bearer <token>" header.
 * Validates the JWT and provides an RLS-scoped client (ctx.supabase) with full userClaims.
 */
export const candidateProfileHandler = {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      const email = ctx.userClaims?.email;

      // Query candidate details using RLS-scoped client
      const { data, error } = await ctx.supabase
        .from("candidates")
        .select("*")
        .eq("id", userId || "")
        .single();

      // Fallback or secondary query if they have not set up Supabase yet
      if (error) {
        return Response.json({
          message: "Auth validation succeeded! However, candidate profile record was not found or table is empty in Supabase.",
          authMode: ctx.authMode,
          userId,
          email,
          error: error.message,
          hint: "Make sure you registered your account or ran the Supabase SQL migration to create the candidates table.",
        });
      }

      return Response.json({
        message: "Successfully fetched authenticated profile with 'user' auth mode!",
        authMode: ctx.authMode,
        userId,
        email,
        candidate: data,
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Failed to retrieve candidate profile." }, { status: 500 });
    }
  }),
};

/**
 * 4. Auth Mode: "secret"
 * Requires a valid Supabase secret key (service_role key) in the "apikey" or "Authorization" header.
 * Bypasses Row Level Security (RLS) and provides ctx.supabaseAdmin to perform elevated operations.
 */
export const adminCandidatesListHandler = {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    try {
      // Query all candidates bypassing RLS using ctx.supabaseAdmin client
      const { data, error } = await ctx.supabaseAdmin
        .from("candidates")
        .select("id, fullName, email, mobile")
        .limit(50);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({
        message: "Successfully bypassed RLS to list candidates using 'secret' auth mode.",
        authMode: ctx.authMode,
        candidatesCount: data ? data.length : 0,
        candidates: data || [],
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Failed to list candidates as admin." }, { status: 500 });
    }
  }),
};
