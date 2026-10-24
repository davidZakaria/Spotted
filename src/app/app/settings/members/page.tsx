import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteMemberAction } from "@/lib/actions";
import { Button, Card, Field, PageHeader } from "@/components/ui";

export default async function MembersPage() {
  const session = await requireSession();
  const locale = session.locale === "ar" ? "ar" : "en";
  const members = await prisma.membership.findMany({
    where: { workspaceId: session.workspaceId },
    include: { user: true },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <PageHeader
          title={locale === "ar" ? "فريقك" : "Your team"}
          description={locale === "ar"
            ? "ادعُ زميلاً لديه حساب سبوتد. المالك والمدير يغيّران الإعدادات. المحرر ينشر. المشاهد يقرأ فقط."
            : "Invite a teammate who already has a Spotted login. Owners and admins change settings. Editors can publish. Viewers only read."}
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
            <Button type="submit">{locale === "ar" ? "إضافة زميل" : "Add teammate"}</Button>
          </form>
        </Card>
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
