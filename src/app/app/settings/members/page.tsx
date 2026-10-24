import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteMemberAction } from "@/lib/actions";
import { Button, Card, Field } from "@/components/ui";

export default async function MembersPage() {
  const session = await requireSession();
  const members = await prisma.membership.findMany({
    where: { workspaceId: session.workspaceId },
    include: { user: true },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="mb-4 text-sm text-muted">Roles: owner, admin, editor, viewer. The person you invite must already have an Aether login.</p>
        <Card>
          <form action={inviteMemberAction} className="space-y-3">
            <Field label="Email"><input name="email" type="email" required /></Field>
            <Field label="Role">
              <select name="role" defaultValue="EDITOR">
                <option value="ADMIN">Admin</option>
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </Field>
            <Button type="submit">Add member</Button>
          </form>
        </Card>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <Card key={m.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{m.user.name}</p>
              <p className="text-xs text-muted">{m.user.email}</p>
            </div>
            <span className="text-xs uppercase text-muted">{m.role}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
