import { nextTick, ref, watch } from "vue";
import {
  useForm,
  type FormOptions,
  type SubmissionHandler,
  type TypedSchema,
} from "vee-validate";
import type { z as zod } from "zod";
import { getErrorMessage } from "@/api/request";

export function useAuthForm<Values extends Record<string, unknown>>(
  schema: zod.ZodType<Values>,
  initialValues: FormOptions<Values>["initialValues"],
) {
  const validationSchema: TypedSchema<Values> = {
    __type: "VVTypedSchema",
    async parse(values) {
      const result = await schema.safeParseAsync(values);
      if (result.success) return { value: result.data, errors: [] };
      return {
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          errors: [issue.message],
        })),
      };
    },
  };

  const form = useForm<Values>({ validationSchema, initialValues });
  const serverError = ref("");

  watch(
    form.values,
    () => {
      serverError.value = "";
    },
    { flush: "sync" },
  );

  function submit(handler: SubmissionHandler<Values>) {
    const handleSubmit = form.handleSubmit(
      async (values, context) => {
        serverError.value = "";
        try {
          await handler(values, context);
        } catch (error) {
          serverError.value = getErrorMessage(error);
        }
      },
      async () => {
        await nextTick();
        document
          .querySelector<HTMLInputElement>('input[aria-invalid="true"]')
          ?.focus();
      },
    );

    return (event?: Event) => {
      event?.preventDefault();
      if (form.isSubmitting.value) return;
      return handleSubmit(event);
    };
  }

  return { ...form, serverError, submit };
}
