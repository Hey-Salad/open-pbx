export type AmiConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  events?: string;
};

const DEFAULTS = {
  host: "192.168.1.105",
  port: 5038,
  username: "admin",
  password: "admin",
  events: "on",
} satisfies AmiConfig;

export const getAmiConfig = (): AmiConfig => {
  const host = process.env.ASTERISK_AMI_HOST || DEFAULTS.host;
  const port = Number(process.env.ASTERISK_AMI_PORT ?? DEFAULTS.port);
  const username = process.env.ASTERISK_AMI_USERNAME || DEFAULTS.username;
  const password = process.env.ASTERISK_AMI_PASSWORD || DEFAULTS.password;
  const events = process.env.ASTERISK_AMI_EVENTS || DEFAULTS.events;

  return { host, port, username, password, events };
};

export const hasCustomAmiCredentials = (): boolean =>
  Boolean(
    process.env.ASTERISK_AMI_HOST ||
      process.env.ASTERISK_AMI_USERNAME ||
      process.env.ASTERISK_AMI_PASSWORD,
  );
