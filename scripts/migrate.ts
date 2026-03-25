import { execSync } from "child_process";

function migrate() {
  let output = "";
  try {
    output = execSync("prisma migrate deploy", {
      stdio: "pipe",
      encoding: "utf8",
    });
    process.stdout.write(output);
    console.log("Migrations deployed successfully.");
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      stderr?: string;
      stdout?: string;
      message?: string;
    };
    const stderr = err.stderr ?? "";
    const stdout = err.stdout ?? "";
    const combined = `${stderr}\n${stdout}`;

    process.stderr.write(stderr);
    process.stdout.write(stdout);

    if (combined.includes("P3009")) {
      console.log(
        "Detected failed migration(s) in database (P3009). Resolving before retrying..."
      );

      // Extract each failed migration name from the Prisma error output.
      // Prisma reports: The `<migration_name>` migration started at ... failed
      // Prisma migration names follow the format: YYYYMMDDHHMMSS_description
      // Validate names against this pattern to prevent any command injection.
      const MIGRATION_NAME_RE = /^[0-9]{14}_[a-zA-Z0-9_]+$/;

      const failedNames = [
        ...combined.matchAll(/The `([^`]+)` migration\b/g),
      ]
        .map((m) => m[1])
        .filter((name) => MIGRATION_NAME_RE.test(name));

      if (failedNames.length === 0) {
        console.error(
          "Could not parse failed migration name(s) from Prisma output. Manual resolution required."
        );
        console.error("Full Prisma output:\n", combined);
        process.exit(1);
      }

      for (const name of failedNames) {
        console.log(`Marking migration as rolled back: ${name}`);
        execSync(`prisma migrate resolve --rolled-back ${name}`, {
          stdio: "inherit",
        });
      }

      console.log("Retrying migration deployment...");
      execSync("prisma migrate deploy", { stdio: "inherit" });
      console.log("Migrations deployed successfully after retry.");
    } else {
      console.error("Migration failed with an unexpected error.");
      process.exit(err.status ?? 1);
    }
  }
}

migrate();
