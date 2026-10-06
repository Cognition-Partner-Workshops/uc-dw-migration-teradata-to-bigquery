import { type ReactNode, useEffect, useState } from 'react';
import { Anchor, Image, type ImageProps, Skeleton } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fileQuery } from '@/api/queries';

interface FileImageProps extends Omit<ImageProps, 'src'> {
  fileId: string;
  alt: string;
  'data-testid'?: string;
}

/**
 * An image served by `GET /files/{id}`: the body is fetched with the API client (bearer token)
 * and rendered through an object URL that is revoked when the file changes or the image unmounts.
 */
export function FileImage({ fileId, alt, ...imageProps }: FileImageProps) {
  const file = useQuery(fileQuery(fileId));
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    if (!file.data) {
      setSrc(undefined);
      return;
    }
    const url = URL.createObjectURL(file.data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file.data]);

  if (file.isPending || (file.data && !src)) {
    return <Skeleton h={imageProps.h ?? 240} radius={imageProps.radius} />;
  }
  return (
    <Image src={src} alt={alt} fallbackSrc={undefined} {...imageProps} data-file-id={fileId} />
  );
}

interface FileLinkProps {
  fileId: string;
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * Opens a `GET /files/{id}` body in a new tab (the Files related list). A plain `href` cannot
 * carry the bearer token, so the body is fetched first and opened through an object URL.
 */
export function FileLink({ fileId, children, ...props }: FileLinkProps) {
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try {
      const blob = await queryClient.fetchQuery(fileQuery(fileId));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setOpening(false);
    }
  };
  return (
    <Anchor component="button" type="button" size="sm" onClick={open} disabled={opening} {...props}>
      {children}
    </Anchor>
  );
}
