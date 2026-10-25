import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteMemberAction } from "@/lib/actions";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { absoluteUrl } from "@/lib/urls";

export default async function MembersPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.invite.findMany({
      where: { workspaceId: session.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <PageHeader
          title={locale === "ar" ? "فريقك" : "Your team"}
          description={locale === "ar"
            ? "أرسل دعوة بالبريد. إن لم يكن للزميل حساب فسيُنشئه من الرابط."
            : "Invite by email. If they do not have a login yet, the link creates one."}
        />
        <Card>
          <form action={inviteMemberAction} className="space-y-3">
            <Field label={locale === "ar" ? "البريد" : "Email"}><input name="email" type="email" required /></Field>
            <Field label={locale === "ar" ? "الصلاحية" : "Access"}>
              <select name="role" defaultValue="EDITOR">
                <option value="ADMIN">{locale === "ar" ? "مدير" : "Admin"}</option>
                <option value="EDITOR">{locale === "ar" ? "محرر" : "Editor"}</option>
                <option value="VIEWER">{locale === "ar" ? "مشاهد" : "Viewer"}</option>
              </select>
            </Field>
            <Button type="submit">{locale === "ar" ? "إرسال دعوة" : "Send invite"}</Button>
          </form>
        </Card>
        {invites.length ? (
          <Card>
            <h2 className="font-semibold">{locale === "ar" ? "دعوات معلّقة" : "Pending invites"}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {invites.map((invite) => (
                <li key={invite.id} className="rounded-xl bg-bg-soft px-3 py-2">
                  <p>{invite.email} · {invite.role.toLowerCase()}</p>
                  <p className="mt-1 break-all text-xs text-muted">{absoluteUrl(`/signup?invite=${invite.token}`)}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <Card key={member.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{member.user.name}</p>
              <p className="text-xs text-muted">{member.user.email}</p>
            </div>
            <span className="text-xs text-muted">{member.role === "OWNER" ? (locale === "ar" ? "مالك" : "Owner") : member.role.toLowerCase()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
