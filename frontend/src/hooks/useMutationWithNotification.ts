import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { getErrorMessage } from '../lib/errorHandling';

interface UseMutationOptions<TData, TError, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successTitle: string;
  successMessage?: string | ((data: TData) => string);
  errorTitle: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
}

export function useMutationWithNotification<
  TData = unknown,
  TError = unknown,
  TVariables = void
>({
  mutationFn,
  successTitle,
  successMessage,
  errorTitle,
  onSuccess,
  onError,
}: UseMutationOptions<TData, TError, TVariables>): UseMutationResult<TData, TError, TVariables> {
  return useMutation<TData, TError, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      const message = typeof successMessage === 'function' 
        ? successMessage(data) 
        : successMessage ?? 'Operation completed successfully';
      
      showSuccessNotification({
        title: successTitle,
        message,
      });

      if (onSuccess) {
        onSuccess(data, variables);
      }
    },
    onError: (error, variables) => {
      showErrorNotification({
        title: errorTitle,
        message: getErrorMessage(error),
      });

      if (onError) {
        onError(error, variables);
      }
    },
  });
}
